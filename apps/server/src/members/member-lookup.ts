import { and, eq, sql } from "drizzle-orm";
import { AuthDB } from "../database/index.js";
import { member } from "../database/schema/organization.js";
import { memberPermission } from "../database/schema/member-permission.js";
import { memberBranch } from "../database/schema/member-branch.js";

export async function lookupOrgMember(
  userId: string,
  organizationId: string | null | undefined,
): Promise<{ id: string; role: string } | null> {
  if (!organizationId) return null;
  try {
    const [row] = await AuthDB.select({ id: member.id, role: member.role })
      .from(member)
      .where(
        and(eq(member.userId, userId), eq(member.organizationId, organizationId)),
      )
      .limit(1);
    if (!row) return null;
    return { id: row.id, role: row.role };
  } catch {
    return null;
  }
}

export async function lookupMemberPermissions(
  memberId: string | null | undefined,
) {
  if (!memberId) return [];
  try {
    const rows = await AuthDB.select({
      action: memberPermission.action,
      subject: memberPermission.subject,
      effect: memberPermission.effect,
    })
      .from(memberPermission)
      .where(
        and(
          eq(memberPermission.memberId, memberId),
          eq(memberPermission.applicationId, "authentik"),
        ),
      );
    return rows.map((row) => ({
      action: row.action,
      subject: row.subject,
      effect: row.effect,
    }));
  } catch {
    return [];
  }
}

/** Branches the member is limited to; empty means no limit. Throws on a read error; the auth guard turns that into a 403. */
export async function lookupMemberBranchIds(
  memberId: string | null | undefined,
): Promise<string[]> {
  if (!memberId) return [];
  const rows = await AuthDB.select({ branchId: memberBranch.branchId })
    .from(memberBranch)
    .where(eq(memberBranch.memberId, memberId));
  return rows.map((row) => row.branchId);
}

export type MemberContext = {
  id: string;
  role: string;
  permissions: { action: string; subject: string; effect: "allow" | "deny" }[];
};

/**
 * Member + role + permission grants in one round trip (uses member_user_org_idx and
 * member_permission_memberId_idx). Returns null when the user is not in the organization.
 */
export async function lookupMemberContext(
  userId: string,
  organizationId: string | null | undefined,
  appKey = "authentik",
): Promise<MemberContext | null> {
  if (!organizationId) return null;
  try {
    const rows = await AuthDB.execute<{
      id: string;
      role: string;
      permissions: MemberContext["permissions"];
    }>(sql`
      select m.id, m.role,
        coalesce((
          select json_agg(json_build_object(
            'action', p.action, 'subject', p.subject, 'effect', p.effect))
          from auth.member_permission p where p.member_id = m.id and p.application_id = ${appKey}
        ), '[]'::json) as permissions
      from auth.member m
      where m.user_id = ${userId} and m.organization_id = ${organizationId}
      limit 1
    `);
    const row = rows[0];
    return row ? { id: row.id, role: row.role, permissions: row.permissions } : null;
  } catch {
    return null;
  }
}
