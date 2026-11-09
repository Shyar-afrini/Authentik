import { pgSchema } from "drizzle-orm/pg-core";

/** Auth tables live in the PostgreSQL `auth` schema. */
export const authSchema = pgSchema("auth");

export const permissionEffect = authSchema.enum("permission_effect", ["allow", "deny"]);
export const invitationStatus = authSchema.enum("invitation_status", ["pending", "accepted", "rejected", "canceled"]);
