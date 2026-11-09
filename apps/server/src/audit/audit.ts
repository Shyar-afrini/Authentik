import { randomUUID } from "node:crypto";
import { AuthDB } from "../database/index.js";
import { auditLog } from "../database/schema/audit.js";
import { requestContext } from "../common/request-context.js";

export type AuditEntry = {
  action: string;
  resourceType: string;
  resourceId?: string | null;
  organizationId?: string | null;
  /** What changed; never put secrets (passwords, tokens) here. */
  diff?: unknown;
  /** Overrides the request's actor (e.g. a login, where no request is authenticated yet). */
  actorUserId?: string | null;
};

/** Anything with `insert`: the global db or a transaction handle. */
type Db = Pick<typeof AuthDB, "insert">;

/**
 * Write an audit row. Pass the transaction handle so the row commits or rolls back with the
 * change it describes (CLAUDE.md section 5); actor, ip and request id come from the request context.
 */
export async function recordAudit(db: Db, entry: AuditEntry): Promise<void> {
  const ctx = requestContext();
  await db.insert(auditLog).values({
    id: randomUUID(),
    organizationId: entry.organizationId ?? null,
    actorUserId: entry.actorUserId ?? ctx?.actorUserId ?? null,
    action: entry.action,
    resourceType: entry.resourceType,
    resourceId: entry.resourceId ?? null,
    ip: ctx?.ip ?? null,
    requestId: ctx?.requestId ?? null,
    diff: entry.diff ?? null,
  });
}

/** For events Better Auth owns (logins): the change is not in our transaction, so a failed write is logged, not thrown. */
export async function recordAuditBestEffort(entry: AuditEntry): Promise<void> {
  try {
    await recordAudit(AuthDB, entry);
  } catch (error) {
    console.error("[@authentik/auth] audit write failed", error);
  }
}
