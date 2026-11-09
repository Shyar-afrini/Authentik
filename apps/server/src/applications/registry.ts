import { and, eq, sql } from "drizzle-orm";
import { recordAudit } from "../audit/audit.js";
import { AuthDB } from "../database/index.js";
import {
  application,
  appPermissionDef,
  appRoleTemplate,
  type AppGrantRow,
} from "../database/schema/application.js";
import { member } from "../database/schema/organization.js";
import { memberPermission } from "../database/schema/member-permission.js";
import { oauthClientResource, oauthResource } from "../database/schema/oauth.js";
import { PERMISSION_ACTIONS } from "@authentik/auth/permissions";

/** Thrown for caller mistakes; `status` maps straight to the HTTP response. */
export class RegistryError extends Error {
  constructor(
    readonly status: 400 | 401 | 403 | 404 | 409,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export type RegistryInput = {
  name: string;
  /** Token audience for this app (absolute URI). Optional for apps that only use sessions. */
  audience?: string | null;
  subjects: { subject: string; actions?: string[]; description?: string }[];
  roles: { key: string; grants: AppGrantRow[] }[];
};

const KEY_RE = /^[a-z][a-z0-9-]{1,39}$/;
const NAME_RE = /^[A-Za-z][A-Za-z0-9_.:-]{0,79}$/;
const MAX_SUBJECTS = 500;
const MAX_ROLES = 50;
const MAX_GRANTS = 2000;
const ACTIONS: readonly string[] = PERMISSION_ACTIONS;

export function assertAppKey(key: string): void {
  if (!KEY_RE.test(key)) {
    throw new RegistryError(400, "invalid_app_key", "Application key must be 2-40 chars: lowercase letters, digits, dashes");
  }
}

function assertGrant(g: AppGrantRow, where: string): void {
  if (!ACTIONS.includes(g.action)) {
    throw new RegistryError(400, "invalid_action", `${where}: action must be one of ${ACTIONS.join(", ")}`);
  }
  if (g.subject !== "all" && !NAME_RE.test(g.subject)) {
    throw new RegistryError(400, "invalid_subject", `${where}: invalid subject "${g.subject}"`);
  }
  if (g.effect !== undefined && g.effect !== "allow" && g.effect !== "deny") {
    throw new RegistryError(400, "invalid_effect", `${where}: effect must be allow or deny`);
  }
}

/** Boundary checks for a registry upload; pure so it is unit-tested without a database. */
export function validateRegistryInput(input: RegistryInput): void {
  if (!input || typeof input.name !== "string" || !input.name.trim() || input.name.length > 120) {
    throw new RegistryError(400, "invalid_name", "name is required (max 120 chars)");
  }
  if (input.audience) {
    try {
      const url = new URL(input.audience);
      if (url.hash) throw new Error("fragment");
    } catch {
      throw new RegistryError(400, "invalid_audience", "audience must be an absolute URI without a fragment");
    }
  }
  if (!Array.isArray(input.subjects) || input.subjects.length > MAX_SUBJECTS) {
    throw new RegistryError(400, "invalid_subjects", `subjects must be an array of at most ${MAX_SUBJECTS}`);
  }
  if (!Array.isArray(input.roles) || input.roles.length > MAX_ROLES) {
    throw new RegistryError(400, "invalid_roles", `roles must be an array of at most ${MAX_ROLES}`);
  }
  const subjects = new Set<string>();
  for (const s of input.subjects) {
    if (typeof s.subject !== "string" || !NAME_RE.test(s.subject)) {
      throw new RegistryError(400, "invalid_subject", `invalid subject "${String(s.subject)}"`);
    }
    for (const a of s.actions ?? []) {
      if (!ACTIONS.includes(a)) {
        throw new RegistryError(400, "invalid_action", `${s.subject}: unknown action "${a}"`);
      }
    }
    if ((s.description?.length ?? 0) > 300) {
      throw new RegistryError(400, "invalid_description", `${s.subject}: description too long`);
    }
    if (subjects.has(s.subject)) {
      throw new RegistryError(400, "duplicate_subject", `subject "${s.subject}" is declared twice`);
    }
    subjects.add(s.subject);
  }
  const roleKeys = new Set<string>();
  for (const r of input.roles) {
    if (typeof r.key !== "string" || !NAME_RE.test(r.key) || roleKeys.has(r.key)) {
      throw new RegistryError(400, "invalid_role", `invalid or duplicate role "${String(r.key)}"`);
    }
    roleKeys.add(r.key);
    if (!Array.isArray(r.grants) || r.grants.length > MAX_GRANTS) {
      throw new RegistryError(400, "invalid_role", `${r.key}: grants must be an array of at most ${MAX_GRANTS}`);
    }
    for (const g of r.grants) {
      assertGrant(g, `role ${r.key}`);
      if (g.subject !== "all" && !subjects.has(g.subject)) {
        throw new RegistryError(400, "unknown_subject", `role ${r.key}: subject "${g.subject}" is not declared in subjects`);
      }
    }
  }
}

/** Create or replace an application's vocabulary (subjects, role templates) in one transaction. */
export async function upsertApplication(key: string, input: RegistryInput): Promise<void> {
  assertAppKey(key);
  validateRegistryInput(input);
  const now = new Date();
  await AuthDB.transaction(async (tx) => {
    try {
      await tx
        .insert(application)
        .values({ id: key, key, name: input.name.trim(), audience: input.audience ?? null })
        .onConflictDoUpdate({
          target: application.key,
          set: { name: input.name.trim(), audience: input.audience ?? null, updatedAt: now },
        });
    } catch (error) {
      if ((error as { code?: string }).code === "23505") {
        throw new RegistryError(409, "audience_taken", "audience already belongs to another application");
      }
      throw error;
    }
    await recordAudit(tx, {
      action: "app.registry_replaced",
      resourceType: "application",
      resourceId: key,
      diff: {
        name: input.name.trim(),
        audience: input.audience ?? null,
        subjects: input.subjects.map((s) => s.subject),
        roles: input.roles.map((r) => r.key),
      },
    });
    await tx.delete(appPermissionDef).where(eq(appPermissionDef.applicationId, key));
    await tx.delete(appRoleTemplate).where(eq(appRoleTemplate.applicationId, key));
    const defs = input.subjects.flatMap((s) =>
      (s.actions?.length ? s.actions : [...ACTIONS]).map((action) => ({
        id: crypto.randomUUID(),
        applicationId: key,
        subject: s.subject,
        action,
        description: s.description ?? null,
      })),
    );
    if (defs.length) await tx.insert(appPermissionDef).values(defs);
    if (input.roles.length) {
      await tx.insert(appRoleTemplate).values(
        input.roles.map((r) => ({
          id: crypto.randomUUID(),
          applicationId: key,
          roleKey: r.key,
          grants: r.grants,
        })),
      );
    }
    if (input.audience) {
      // Make the audience a requestable OAuth resource so tokens for it are JWTs.
      await tx
        .insert(oauthResource)
        .values({ id: crypto.randomUUID(), identifier: input.audience, name: input.name.trim(), createdAt: now, updatedAt: now })
        .onConflictDoNothing({ target: oauthResource.identifier });
    }
  });
}

export async function getApplicationRegistry(key: string) {
  assertAppKey(key);
  const [app] = await AuthDB.select().from(application).where(eq(application.key, key)).limit(1);
  if (!app) throw new RegistryError(404, "app_not_found", `Application "${key}" is not registered`);
  const [defs, roles] = await Promise.all([
    AuthDB.select({ subject: appPermissionDef.subject, action: appPermissionDef.action, description: appPermissionDef.description })
      .from(appPermissionDef)
      .where(eq(appPermissionDef.applicationId, key)),
    AuthDB.select({ key: appRoleTemplate.roleKey, grants: appRoleTemplate.grants })
      .from(appRoleTemplate)
      .where(eq(appRoleTemplate.applicationId, key)),
  ]);
  return { key: app.key, name: app.name, audience: app.audience, subjects: defs, roles };
}

async function assertMemberInOrg(memberId: string, organizationId: string): Promise<void> {
  const [row] = await AuthDB.select({ id: member.id })
    .from(member)
    .where(and(eq(member.id, memberId), eq(member.organizationId, organizationId)))
    .limit(1);
  if (!row) throw new RegistryError(404, "member_not_found", "Member not found in this organization");
}

export async function listAppGrants(memberId: string, organizationId: string, appKey: string) {
  assertAppKey(appKey);
  await assertMemberInOrg(memberId, organizationId);
  return AuthDB.select({ action: memberPermission.action, subject: memberPermission.subject, effect: memberPermission.effect })
    .from(memberPermission)
    .where(
      and(
        eq(memberPermission.memberId, memberId),
        eq(memberPermission.organizationId, organizationId),
        eq(memberPermission.applicationId, appKey),
      ),
    );
}

/** Replace a member's grants for one application; subjects must exist in that app's registry. */
export async function replaceAppGrants(
  memberId: string,
  organizationId: string,
  appKey: string,
  grants: AppGrantRow[],
): Promise<AppGrantRow[]> {
  assertAppKey(appKey);
  if (!Array.isArray(grants) || grants.length > MAX_GRANTS) {
    throw new RegistryError(400, "invalid_grants", `grants must be an array of at most ${MAX_GRANTS}`);
  }
  for (const g of grants) assertGrant(g, "grant");
  await assertMemberInOrg(memberId, organizationId);
  const known = await AuthDB.select({ subject: appPermissionDef.subject })
    .from(appPermissionDef)
    .where(eq(appPermissionDef.applicationId, appKey));
  if (!known.length) throw new RegistryError(404, "app_not_found", `Application "${appKey}" has no registered permissions`);
  const subjects = new Set(known.map((k) => k.subject));
  for (const g of grants) {
    if (g.subject !== "all" && !subjects.has(g.subject)) {
      throw new RegistryError(400, "unknown_subject", `"${g.subject}" is not a subject of ${appKey}`);
    }
  }
  const now = new Date();
  await AuthDB.transaction(async (tx) => {
    const scope = and(
      eq(memberPermission.memberId, memberId),
      eq(memberPermission.organizationId, organizationId),
      eq(memberPermission.applicationId, appKey),
    );
    const before = await tx
      .select({ action: memberPermission.action, subject: memberPermission.subject, effect: memberPermission.effect })
      .from(memberPermission)
      .where(scope);
    await tx.delete(memberPermission).where(scope);
    await recordAudit(tx, {
      action: "member.permissions_replaced",
      resourceType: "member",
      resourceId: memberId,
      organizationId,
      diff: { app: appKey, before, after: grants.map((g) => ({ ...g, effect: g.effect ?? "allow" })) },
    });
    if (grants.length) {
      await tx.insert(memberPermission).values(
        grants.map((g) => ({
          id: crypto.randomUUID(),
          memberId,
          organizationId,
          applicationId: appKey,
          action: g.action,
          subject: g.subject,
          effect: g.effect ?? ("allow" as const),
          createdAt: now,
          updatedAt: now,
        })),
      ).onConflictDoNothing();
    }
  });
  return grants.map((g) => ({ ...g, effect: g.effect ?? "allow" }));
}

/** Allow an OAuth client to request tokens for an application's audience. */
export async function linkClientToApp(clientId: string, appKey: string): Promise<void> {
  assertAppKey(appKey);
  const [app] = await AuthDB.select({ audience: application.audience }).from(application).where(eq(application.key, appKey)).limit(1);
  if (!app) throw new RegistryError(404, "app_not_found", `Application "${appKey}" is not registered`);
  if (!app.audience) throw new RegistryError(400, "no_audience", `Application "${appKey}" has no audience`);
  const [resource] = await AuthDB.select({ id: oauthResource.id }).from(oauthResource).where(eq(oauthResource.identifier, app.audience)).limit(1);
  if (!resource) throw new RegistryError(404, "resource_not_found", "OAuth resource missing; re-register the application");
  await AuthDB.insert(oauthClientResource)
    .values({ id: crypto.randomUUID(), clientId, resourceId: app.audience, createdAt: new Date() })
    .onConflictDoNothing();
}

/** Application key for a token audience, or null. */
export async function appKeyForAudience(audience: string): Promise<string | null> {
  const [row] = await AuthDB.select({ key: application.key }).from(application).where(eq(application.audience, audience)).limit(1);
  return row?.key ?? null;
}
