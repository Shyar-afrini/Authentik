import { sql } from "drizzle-orm";
import { boolean, integer, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { authSchema } from "./schema.js";
import { organization } from "./organization.js";
import { user } from "./user.js";

/** Per-organization policy. A missing row means the defaults. */
export const organizationSetting = authSchema.table("organization_setting", {
  organizationId: uuid("organization_id")
    .primaryKey()
    .references(() => organization.id, { onDelete: "cascade" }),
  requireTwoFactor: boolean("require_two_factor").notNull().default(false),
  /** Sessions older than this are refused for this organization; null follows the server default. */
  sessionMaxAgeSeconds: integer("session_max_age_seconds"),
  passwordMinLength: integer("password_min_length").notNull().default(8),
  /** Browser origins of this organization's applications (CORS and redirect trust). */
  allowedOrigins: text("allowed_origins").array().notNull().default(sql`'{}'::text[]`),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: uuid("updated_by").references(() => user.id, { onDelete: "set null" }),
});
