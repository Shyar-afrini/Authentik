import { index, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { authSchema, permissionEffect } from "./schema.js";
import { application } from "./application.js";
import { member, organization } from "./organization.js";

export const memberPermission = authSchema.table(
  "member_permission",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => member.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    /** Which application the grant belongs to; existing rows are the `nexus` app. */
    applicationId: text("application_id")
      .notNull()
      .default("authentik")
      .references(() => application.id, { onDelete: "cascade" }),
    action: text("action").notNull(),
    subject: text("subject").notNull(),
    effect: permissionEffect("effect")
      .default("allow")
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("member_permission_member_app_action_subject_idx").on(
      table.memberId,
      table.applicationId,
      table.action,
      table.subject,
    ),
    index("member_permission_memberId_idx").on(table.memberId),
    index("member_permission_organizationId_idx").on(table.organizationId),
  ],
);
