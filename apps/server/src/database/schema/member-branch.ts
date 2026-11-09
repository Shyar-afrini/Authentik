import { index, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { authSchema } from "./schema.js";
import { member, organization } from "./organization.js";

/**
 * Branches a member may work in. No rows means every branch.
 * The branch is an HRM row, so branch_id has no foreign key.
 */
export const memberBranch = authSchema.table(
  "member_branch",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => member.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("member_branch_member_branch_idx").on(table.memberId, table.branchId),
    index("member_branch_memberId_idx").on(table.memberId),
    index("member_branch_organizationId_idx").on(table.organizationId),
  ],
);
