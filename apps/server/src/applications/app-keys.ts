import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import type { Redis } from "ioredis";
import { recordAudit } from "../audit/audit.js";
import { AuthDB } from "../database/index.js";
import { application, applicationKey } from "../database/schema/application.js";
import { assertAppKey, RegistryError } from "./registry.js";

/** Header an application sends with its key on server-to-server calls. */
export const APP_KEY_HEADER = "x-authentik-app-key";

/** The application every request belongs to when it names none, kept for hosts that predate app keys. */
export const AUTHENTIK_APP = "authentik";
const DEFAULT_APP = AUTHENTIK_APP;
const KEY_RE = /^nak_([a-z][a-z0-9-]{1,39})_([0-9a-f]{64})$/;
const CACHE_MS = 5_000;
const TOUCH_MS = 60_000;

/** `nak_<application>_<64 hex>`: the application is readable from the key, the rest is the secret. */
export function generateAppKey(app: string): { secret: string; hash: string; hint: string } {
  assertAppKey(app);
  const secret = `nak_${app}_${randomBytes(32).toString("hex")}`;
  return { secret, hash: hashAppKey(secret), hint: secret.slice(-4) };
}

export function hashAppKey(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

/** The application a key names, without checking it; null when the text is not shaped like a key. */
export function parseAppKey(raw: string | null | undefined): { app: string } | null {
  const m = KEY_RE.exec((raw ?? "").trim());
  return m ? { app: m[1] } : null;
}

type Lookups = {
  /** Application owning the active key with this hash, or null. */
  appForKeyHash: (hash: string) => Promise<string | null>;
  /** Whether the application has an active key (and so no longer accepts anonymous callers). */
  hasActiveKey: (app: string) => Promise<boolean>;
};

/**
 * Decide which application a request acts as.
 * - With a key: the key decides. A claimed `?app=` that differs is refused, so a key cannot be used for another app.
 * - Without: the claimed app (or the default) is only allowed while it has no key issued.
 */
export async function resolveCaller(
  input: { key?: string | null; claimed?: string | null },
  lookups: Lookups,
): Promise<string> {
  const key = input.key?.trim();
  if (key) {
    const parsed = parseAppKey(key);
    const app = parsed ? await lookups.appForKeyHash(hashAppKey(key)) : null;
    if (!app || app !== parsed?.app) throw new RegistryError(401, "invalid_app_key", "Application key is invalid or revoked");
    if (input.claimed && input.claimed !== app) {
      throw new RegistryError(403, "app_mismatch", "This key belongs to a different application");
    }
    return app;
  }
  const app = input.claimed || DEFAULT_APP;
  if (await lookups.hasActiveKey(app)) {
    throw new RegistryError(401, "app_key_required", `Application "${app}" requires its application key (${APP_KEY_HEADER})`);
  }
  return app;
}

type Cached<T> = { at: number; value: T };
const keyCache = new Map<string, Cached<string | null>>();
const hasKeyCache = new Map<string, Cached<boolean>>();
const lastTouch = new Map<string, number>();

function fresh<T>(cache: Map<string, Cached<T>>, k: string): Cached<T> | undefined {
  const hit = cache.get(k);
  return hit && Date.now() - hit.at < CACHE_MS ? hit : undefined;
}

function remember<T>(cache: Map<string, Cached<T>>, k: string, value: T): T {
  if (cache.size >= 1_000) cache.delete(cache.keys().next().value!);
  cache.set(k, { at: Date.now(), value });
  return value;
}

const CHANGED_CHANNEL = "auth:app-key:changed";
let announceChange: (() => void) | null = null;

function clearCaches(): void {
  keyCache.clear();
  hasKeyCache.clear();
}

/**
 * Issuing, rotating or revoking a key takes effect here at once and on every other auth-server process
 * as soon as Redis delivers the message (without Redis, within CACHE_MS).
 */
function forgetCaches(): void {
  clearCaches();
  announceChange?.();
}

/** Share key changes between auth-server processes over Redis pub/sub. */
export async function shareKeyChanges(redis: Redis): Promise<void> {
  const subscriber = redis.duplicate();
  subscriber.on("error", () => {});
  await subscriber.subscribe(CHANGED_CHANNEL);
  subscriber.on("message", clearCaches);
  announceChange = () => void redis.publish(CHANGED_CHANNEL, "1").catch(() => {});
}

const dbLookups: Lookups = {
  async appForKeyHash(hash) {
    const hit = fresh(keyCache, hash);
    if (hit) return hit.value;
    const [row] = await AuthDB.select({ id: applicationKey.id, app: applicationKey.applicationId })
      .from(applicationKey)
      .where(and(eq(applicationKey.secretHash, hash), isNull(applicationKey.revokedAt)))
      .limit(1);
    if (row && Date.now() - (lastTouch.get(row.id) ?? 0) > TOUCH_MS) {
      lastTouch.set(row.id, Date.now());
      void AuthDB.update(applicationKey).set({ lastUsedAt: new Date() }).where(eq(applicationKey.id, row.id)).catch(() => {});
    }
    return remember(keyCache, hash, row?.app ?? null);
  },
  async hasActiveKey(app) {
    const hit = fresh(hasKeyCache, app);
    if (hit) return hit.value;
    const [row] = await AuthDB.select({ id: applicationKey.id })
      .from(applicationKey)
      .where(and(eq(applicationKey.applicationId, app), isNull(applicationKey.revokedAt)))
      .limit(1);
    return remember(hasKeyCache, app, Boolean(row));
  },
};

export function resolveCallerApp(input: { key?: string | null; claimed?: string | null }): Promise<string> {
  return resolveCaller(input, dbLookups);
}

async function assertApplication(app: string): Promise<void> {
  assertAppKey(app);
  const [row] = await AuthDB.select({ id: application.id }).from(application).where(eq(application.id, app)).limit(1);
  if (!row) throw new RegistryError(404, "app_not_found", `Application "${app}" is not registered`);
}

/** Issue the application's key, revoking the previous one. The secret is returned here and never again. */
export async function issueAppKey(app: string, actorUserId?: string | null): Promise<{ key: string; hint: string }> {
  await assertApplication(app);
  const { secret, hash, hint } = generateAppKey(app);
  await AuthDB.transaction(async (tx) => {
    const revoked = await tx
      .update(applicationKey)
      .set({ revokedAt: new Date() })
      .where(and(eq(applicationKey.applicationId, app), isNull(applicationKey.revokedAt)))
      .returning({ id: applicationKey.id });
    await tx.insert(applicationKey).values({ id: randomUUID(), applicationId: app, secretHash: hash, hint, createdBy: actorUserId ?? null });
    await recordAudit(tx, {
      action: revoked.length ? "app.key_rotated" : "app.key_issued",
      resourceType: "application",
      resourceId: app,
      diff: { hint },
    });
  });
  forgetCaches();
  return { key: secret, hint };
}

export async function revokeAppKey(app: string): Promise<boolean> {
  await assertApplication(app);
  const revoked = await AuthDB.transaction(async (tx) => {
    const rows = await tx
      .update(applicationKey)
      .set({ revokedAt: new Date() })
      .where(and(eq(applicationKey.applicationId, app), isNull(applicationKey.revokedAt)))
      .returning({ id: applicationKey.id });
    if (rows.length) await recordAudit(tx, { action: "app.key_revoked", resourceType: "application", resourceId: app });
    return rows.length > 0;
  });
  forgetCaches();
  return revoked;
}

/** What an operator may see about the active key: never the secret. */
export async function getAppKeyInfo(app: string) {
  await assertApplication(app);
  const [row] = await AuthDB.select({
    hint: applicationKey.hint,
    createdAt: applicationKey.createdAt,
    lastUsedAt: applicationKey.lastUsedAt,
  })
    .from(applicationKey)
    .where(and(eq(applicationKey.applicationId, app), isNull(applicationKey.revokedAt)))
    .limit(1);
  return row ? { active: true as const, ...row } : { active: false as const };
}

