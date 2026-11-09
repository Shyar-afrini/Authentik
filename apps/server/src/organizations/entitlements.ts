import { and, eq, sql } from "drizzle-orm";
import { AuthDB } from "../database/index.js";
import { CLIENT_TYPES, organizationApplication, type ClientType } from "../database/schema/application.js";
import { BadRequestException } from "../members/errors.js";
import { recordAudit } from "../audit/audit.js";

/** Whether the organization (client) may use the application. */
export async function isOrgEntitled(organizationId: string, app: string): Promise<boolean> {
  const [row] = await AuthDB.select({ o: organizationApplication.organizationId })
    .from(organizationApplication)
    .where(and(eq(organizationApplication.organizationId, organizationId), eq(organizationApplication.applicationId, app)))
    .limit(1);
  return !!row;
}

export async function listOrgApps(organizationId: string): Promise<string[]> {
  const rows = await AuthDB.select({ a: organizationApplication.applicationId })
    .from(organizationApplication)
    .where(eq(organizationApplication.organizationId, organizationId));
  return rows.map((r) => r.a);
}

export type OrgAppDetail = { app: string; clientTypes: string[] };

export async function listOrgAppDetails(organizationId: string): Promise<OrgAppDetail[]> {
  const rows = await AuthDB.select({ a: organizationApplication.applicationId, t: organizationApplication.clientTypes })
    .from(organizationApplication)
    .where(eq(organizationApplication.organizationId, organizationId));
  return rows.map((r) => ({ app: r.a, clientTypes: r.t }));
}

export function parseClientTypes(input: unknown): ClientType[] {
  if (input === undefined) return [];
  if (!Array.isArray(input) || input.some((t) => !CLIENT_TYPES.includes(t as ClientType))) {
    throw new BadRequestException(`clientTypes must be a list of: ${CLIENT_TYPES.join(", ")}`);
  }
  return [...new Set(input as ClientType[])];
}

/** Organizations entitled to the application, among the given ones (used to narrow token claims). */
export async function entitledOrgIds(app: string): Promise<Set<string>> {
  const rows = await AuthDB.select({ o: organizationApplication.organizationId })
    .from(organizationApplication)
    .where(eq(organizationApplication.applicationId, app));
  return new Set(rows.map((r) => r.o));
}

export async function setEntitlement(
  organizationId: string,
  app: string,
  enabled: boolean,
  actorUserId?: string | null,
  /** When given on enable, replaces the connected client types. */
  clientTypes?: ClientType[],
): Promise<void> {
  await AuthDB.transaction(async (tx) => {
    const where = and(eq(organizationApplication.organizationId, organizationId), eq(organizationApplication.applicationId, app));
    const changed = enabled
      ? await tx
          .insert(organizationApplication)
          .values({ organizationId, applicationId: app, createdBy: actorUserId ?? null, clientTypes: clientTypes ?? [] })
          .onConflictDoUpdate({
            target: [organizationApplication.organizationId, organizationApplication.applicationId],
            set: { clientTypes: clientTypes ?? sql`${organizationApplication.clientTypes}` },
            setWhere: clientTypes ? sql`${organizationApplication.clientTypes} is distinct from ${sql.raw("excluded.client_types")}` : sql`false`,
          })
          .returning({ o: organizationApplication.organizationId })
      : await tx.delete(organizationApplication).where(where).returning({ o: organizationApplication.organizationId });
    if (!changed.length) return;
    await recordAudit(tx, {
      action: enabled ? "org.app_granted" : "org.app_revoked",
      resourceType: "organization_application",
      resourceId: `${organizationId}:${app}`,
      organizationId,
      actorUserId,
      diff: { app, clientTypes },
    });
  });
}
