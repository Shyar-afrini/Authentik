import { sql } from "drizzle-orm";
import { index, jsonb, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { organization } from "./organization.js";
import { user } from "./user.js";
import { authSchema } from "./schema.js";

/** A project/platform that trusts this auth server and owns its own permission vocabulary. */
export const application = authSchema.table("application", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  /** JWT `aud` / OAuth resource identifier tokens for this app carry. */
  audience: text("audience").unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const CLIENT_TYPES = ["nestjs", "nextjs", "react-native"] as const;
export type ClientType = (typeof CLIENT_TYPES)[number];

/** One (subject, action) the application can be granted. */
export const appPermissionDef = authSchema.table(
  "app_permission_def",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: text("application_id")
      .notNull()
      .references(() => application.id, { onDelete: "cascade" }),
    subject: text("subject").notNull(),
    action: text("action").notNull(),
    description: text("description"),
  },
  (table) => [
    uniqueIndex("app_permission_def_app_subject_action_idx").on(
      table.applicationId,
      table.subject,
      table.action,
    ),
  ],
);

export type AppGrantRow = { action: string; subject: string; effect?: "allow" | "deny" };

/** Named bundle of grants (owner, admin, member, ...) for an application. */
export const appRoleTemplate = authSchema.table(
  "app_role_template",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: text("application_id")
      .notNull()
      .references(() => application.id, { onDelete: "cascade" }),
    roleKey: text("role_key").notNull(),
    grants: jsonb("grants").$type<AppGrantRow[]>().notNull().default([]),
  },
  (table) => [
    uniqueIndex("app_role_template_app_role_idx").on(table.applicationId, table.roleKey),
    index("app_role_template_applicationId_idx").on(table.applicationId),
  ],
);

/**
 * The secret one application presents to this server. Only a SHA-256 of the secret is stored, so a
 * database read cannot recover it; at most one key per application is active (rotation revokes the old one).
 */
export const applicationKey = authSchema.table(
  "application_key",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: text("application_id")
      .notNull()
      .references(() => application.id, { onDelete: "cascade" }),
    secretHash: text("secret_hash").notNull().unique(),
    /** Last characters of the secret, so an operator can tell which key an app is running. */
    hint: text("hint").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    createdBy: uuid("created_by").references(() => user.id, { onDelete: "set null" }),
    lastUsedAt: timestamp("last_used_at"),
    revokedAt: timestamp("revoked_at"),
  },
  (table) => [
    uniqueIndex("application_key_one_active_idx").on(table.applicationId).where(sql`${table.revokedAt} is null`),
  ],
);

/** Which applications an organization (a client) may use. No row means no access to that app. */
export const organizationApplication = authSchema.table(
  "organization_application",
  {
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    applicationId: text("application_id")
      .notNull()
      .references(() => application.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    createdBy: uuid("created_by").references(() => user.id, { onDelete: "set null" }),
    /** Which kinds of client the organization connects for this application (see CLIENT_TYPES). */
    clientTypes: text("client_types").array().notNull().default(sql`'{}'::text[]`),
  },
  (table) => [
    primaryKey({ columns: [table.organizationId, table.applicationId] }),
    index("organization_application_app_idx").on(table.applicationId),
  ],
);
