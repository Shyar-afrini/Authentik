import { index, jsonb, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { authSchema } from "./schema.js";

/** Insert-only record of security-relevant actions (a trigger rejects UPDATE; retention deletes whole old rows). */
export const auditLog = authSchema.table(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    at: timestamp("at", { withTimezone: true }).defaultNow().notNull(),
    organizationId: uuid("organization_id"),
    actorUserId: uuid("actor_user_id"),
    action: text("action").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id"),
    ip: text("ip"),
    requestId: text("request_id"),
    diff: jsonb("diff"),
  },
  (table) => [
    index("audit_log_org_at_idx").on(table.organizationId, table.at.desc()),
    index("audit_log_actor_at_idx").on(table.actorUserId, table.at.desc()),
    index("audit_log_action_at_idx").on(table.action, table.at.desc()),
  ],
);
