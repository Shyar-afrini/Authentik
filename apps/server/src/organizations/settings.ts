import { eq, sql } from "drizzle-orm";
import { recordAudit } from "../audit/audit.js";
import { AuthDB } from "../database/index.js";
import { organizationSetting } from "../database/schema/organization-setting.js";
import { BadRequestException } from "../members/errors.js";

export type OrgSettings = {
  requireTwoFactor: boolean;
  sessionMaxAgeSeconds: number | null;
  passwordMinLength: number;
  allowedOrigins: string[];
};

export const DEFAULT_SETTINGS: OrgSettings = {
  requireTwoFactor: false,
  sessionMaxAgeSeconds: null,
  passwordMinLength: 8,
  allowedOrigins: [],
};

const CACHE_MS = 15_000;
const cache = new Map<string, { at: number; value: OrgSettings }>();
let originsCache: { at: number; value: string[] } | undefined;

export async function getOrgSettings(organizationId: string): Promise<OrgSettings> {
  const hit = cache.get(organizationId);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  const [row] = await AuthDB.select().from(organizationSetting).where(eq(organizationSetting.organizationId, organizationId)).limit(1);
  const value: OrgSettings = row
    ? {
        requireTwoFactor: row.requireTwoFactor,
        sessionMaxAgeSeconds: row.sessionMaxAgeSeconds,
        passwordMinLength: row.passwordMinLength,
        allowedOrigins: row.allowedOrigins,
      }
    : DEFAULT_SETTINGS;
  if (cache.size >= 1_000) cache.delete(cache.keys().next().value!);
  cache.set(organizationId, { at: Date.now(), value });
  return value;
}

/** Validates a patch; throws 400 on anything out of range. Pure, so it is unit-tested. */
export function parseSettingsPatch(input: unknown): Partial<OrgSettings> {
  const body = (input ?? {}) as Record<string, unknown>;
  const out: Partial<OrgSettings> = {};
  if ("requireTwoFactor" in body) {
    if (typeof body.requireTwoFactor !== "boolean") throw new BadRequestException("requireTwoFactor must be a boolean");
    out.requireTwoFactor = body.requireTwoFactor;
  }
  if ("sessionMaxAgeSeconds" in body) {
    const v = body.sessionMaxAgeSeconds;
    if (v !== null && (!Number.isInteger(v) || (v as number) < 300 || (v as number) > 31_536_000)) {
      throw new BadRequestException("sessionMaxAgeSeconds must be null or between 300 and 31536000");
    }
    out.sessionMaxAgeSeconds = v as number | null;
  }
  if ("passwordMinLength" in body) {
    const v = body.passwordMinLength;
    if (!Number.isInteger(v) || (v as number) < 8 || (v as number) > 128) throw new BadRequestException("passwordMinLength must be between 8 and 128");
    out.passwordMinLength = v as number;
  }
  if ("allowedOrigins" in body) {
    const v = body.allowedOrigins;
    if (!Array.isArray(v) || v.length > 50) throw new BadRequestException("allowedOrigins must be a list of at most 50 origins");
    out.allowedOrigins = [
      ...new Set(
        v.map((o) => {
          try {
            const url = new URL(String(o));
            if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
            return url.origin;
          } catch {
            throw new BadRequestException(`"${String(o).slice(0, 80)}" is not a valid http(s) origin`);
          }
        }),
      ),
    ];
  }
  return out;
}

export async function updateOrgSettings(organizationId: string, patch: Partial<OrgSettings>, actorUserId?: string | null): Promise<OrgSettings> {
  await AuthDB.transaction(async (tx) => {
    await tx
      .insert(organizationSetting)
      .values({ organizationId, ...patch, updatedBy: actorUserId ?? null })
      .onConflictDoUpdate({ target: organizationSetting.organizationId, set: { ...patch, updatedAt: new Date(), updatedBy: actorUserId ?? null } });
    await recordAudit(tx, { action: "org.settings_updated", resourceType: "organization_setting", resourceId: organizationId, organizationId, actorUserId, diff: patch });
  });
  cache.delete(organizationId);
  originsCache = undefined;
  return getOrgSettings(organizationId);
}

/** Every organization's allowed browser origins; feeds CORS and Better Auth's trusted origins. */
export async function allOrgOrigins(): Promise<string[]> {
  if (originsCache && Date.now() - originsCache.at < CACHE_MS) return originsCache.value;
  const rows = await AuthDB.execute<{ o: string }>(sql`select distinct unnest(allowed_origins) as o from auth.organization_setting`);
  const value = rows.map((r) => r.o);
  originsCache = { at: Date.now(), value };
  return value;
}
