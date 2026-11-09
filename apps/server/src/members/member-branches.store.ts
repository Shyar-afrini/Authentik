import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { recordAudit } from "../audit/audit.js";
import { AuthDB } from "../database/index.js";
import { memberBranch } from "../database/schema/member-branch.js";
import { member } from "../database/schema/organization.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BRANCHES = 500;

async function assertMemberInOrg(memberId: string, organizationId: string) {
  const [row] = await AuthDB.select({ id: member.id })
    .from(member)
    .where(and(eq(member.id, memberId), eq(member.organizationId, organizationId)))
    .limit(1);
  if (!row) throw new Error(`Member ${memberId} not found in organization`);
}

export async function listMemberBranches(memberId: string, organizationId: string) {
  await assertMemberInOrg(memberId, organizationId);
  const rows = await AuthDB.select({ branchId: memberBranch.branchId })
    .from(memberBranch)
    .where(and(eq(memberBranch.memberId, memberId), eq(memberBranch.organizationId, organizationId)));
  return rows.map((row) => row.branchId);
}

/** Replaces the whole list. An empty list lifts the limit. */
export async function replaceMemberBranches(
  memberId: string,
  organizationId: string,
  branchIds: unknown,
) {
  await assertMemberInOrg(memberId, organizationId);
  if (!Array.isArray(branchIds) || branchIds.length > MAX_BRANCHES) {
    throw new Error(`branchIds must be an array of at most ${MAX_BRANCHES} ids`);
  }
  const unique = [...new Set(branchIds.map((id) => String(id).toLowerCase()))];
  for (const id of unique) {
    if (!UUID.test(id)) throw new Error(`Invalid branch id: ${id}`);
  }
  await AuthDB.transaction(async (tx) => {
    const scope = and(eq(memberBranch.memberId, memberId), eq(memberBranch.organizationId, organizationId));
    const before = (await tx.select({ branchId: memberBranch.branchId }).from(memberBranch).where(scope)).map((r) => r.branchId);
    await tx.delete(memberBranch).where(scope);
    await recordAudit(tx, {
      action: "member.branches_replaced",
      resourceType: "member",
      resourceId: memberId,
      organizationId,
      diff: { before, after: unique },
    });
    if (unique.length) {
      await tx
        .insert(memberBranch)
        .values(unique.map((branchId) => ({ id: randomUUID(), memberId, organizationId, branchId })));
    }
  });
  return unique;
}
