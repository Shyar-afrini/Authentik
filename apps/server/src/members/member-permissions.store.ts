import { and, eq } from "drizzle-orm";
import { AUTHENTIK_APP } from "../applications/app-keys.js";
import { recordAudit } from "../audit/audit.js";
import { AuthDB } from "../database/index.js";
import { memberPermission } from "../database/schema/member-permission.js";
import { member } from "../database/schema/organization.js";
import {
  isValidAction,
  isValidSubject,
  type PermissionEffect,
} from "@authentik/auth/permissions";

export type MemberPermissionDto = {
  action: string;
  subject: string;
  effect?: PermissionEffect;
};

export async function listMemberPermissions(
  memberId: string,
  organizationId: string,
) {
  await assertMemberInOrg(memberId, organizationId);
  return AuthDB.select({
    action: memberPermission.action,
    subject: memberPermission.subject,
    effect: memberPermission.effect,
  })
    .from(memberPermission)
    .where(
      and(
        eq(memberPermission.memberId, memberId),
        eq(memberPermission.organizationId, organizationId),
          eq(memberPermission.applicationId, AUTHENTIK_APP),
      ),
    );
}

export async function replaceMemberPermissions(
  memberId: string,
  organizationId: string,
  permissions: MemberPermissionDto[],
) {
  await assertMemberInOrg(memberId, organizationId);
  validatePermissions(permissions);

  const now = new Date();
  await AuthDB.transaction(async (tx) => {
    const scope = and(
      eq(memberPermission.memberId, memberId),
      eq(memberPermission.organizationId, organizationId),
      eq(memberPermission.applicationId, AUTHENTIK_APP),
    );
    const before = await tx
      .select({ action: memberPermission.action, subject: memberPermission.subject, effect: memberPermission.effect })
      .from(memberPermission)
      .where(scope);
    await tx.delete(memberPermission).where(scope);
    await recordAudit(tx, {
      action: "member.permissions_replaced",
      resourceType: "member",
      resourceId: memberId,
      organizationId,
      diff: { app: "authentik", before, after: permissions.map((p) => ({ ...p, effect: p.effect ?? "allow" })) },
    });

    if (permissions.length === 0) return;

    await tx.insert(memberPermission).values(
      permissions.map((row) => ({
        id: crypto.randomUUID(),
        memberId,
        organizationId,
        action: row.action,
        subject: row.subject,
        effect: row.effect ?? "allow",
        createdAt: now,
        updatedAt: now,
      })),
    );
  });

  return listMemberPermissions(memberId, organizationId);
}

function validatePermissions(permissions: MemberPermissionDto[]) {
  const seen = new Set<string>();
  for (const row of permissions) {
    if (!isValidAction(row.action)) {
      throw new Error(`Invalid action: ${row.action}`);
    }
    if (!isValidSubject(row.subject)) {
      throw new Error(`Invalid subject: ${row.subject}`);
    }
    if (row.effect && row.effect !== "allow" && row.effect !== "deny") {
      throw new Error(`Invalid effect: ${row.effect}`);
    }
    const key = `${row.action}:${row.subject}`;
    if (seen.has(key)) {
      throw new Error(`Duplicate grant: ${key}`);
    }
    seen.add(key);
  }
}

async function assertMemberInOrg(memberId: string, organizationId: string) {
  const [row] = await AuthDB.select({ id: member.id })
    .from(member)
    .where(
      and(eq(member.id, memberId), eq(member.organizationId, organizationId)),
    )
    .limit(1);
  if (!row) {
    throw new Error(`Member ${memberId} not found in organization`);
  }
}
