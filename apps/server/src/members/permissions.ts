import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "./errors.js";
import { and, eq } from "drizzle-orm";
import { can } from "@authentik/auth";
import { AuthDB } from "../database/index.js";
import { member } from "../database/schema/organization.js";
import {
  listMemberBranches,
  replaceMemberBranches,
} from "./member-branches.store.js";
import {
  listMemberPermissions,
  replaceMemberPermissions,
  type MemberPermissionDto,
} from "./member-permissions.store.js";
import {
  FEATURES_BY_DOMAIN,
  PERMISSION_ACTIONS,
  permissionCatalogPayload,
  templateGrantsForRole,
  type Actions,
  type FeatureSubject,
  type PermissionEffect,
} from "@authentik/auth/permissions";

export type { MemberPermissionDto };

export type EffectiveCell = {
  action: Actions;
  subject: FeatureSubject;
  fromRole: boolean;
  override: PermissionEffect | null;
  effective: boolean;
};

export class MemberPermissionsService {
  listForMember(memberId: string, organizationId: string) {
    return this.mapStoreError(() =>
      listMemberPermissions(memberId, organizationId),
    );
  }

  replaceForMember(
    memberId: string,
    organizationId: string,
    permissions: MemberPermissionDto[],
  ) {
    return this.mapStoreError(() =>
      replaceMemberPermissions(memberId, organizationId, permissions),
    );
  }

  listBranchesForMember(memberId: string, organizationId: string) {
    return this.mapStoreError(() => listMemberBranches(memberId, organizationId));
  }

  replaceBranchesForMember(memberId: string, organizationId: string, branchIds: unknown) {
    return this.mapStoreError(() => replaceMemberBranches(memberId, organizationId, branchIds));
  }

  catalog() {
    return permissionCatalogPayload();
  }

  async effectiveForMember(memberId: string, organizationId: string) {
    const [row] = await AuthDB.select({
      id: member.id,
      role: member.role,
      userId: member.userId,
    })
      .from(member)
      .where(
        and(eq(member.id, memberId), eq(member.organizationId, organizationId)),
      )
      .limit(1);
    if (!row) {
      throw new NotFoundException(
        `Member ${memberId} not found in organization`,
      );
    }

    const overrides = await this.mapStoreError(() =>
      listMemberPermissions(memberId, organizationId),
    );
    const templateGrants = templateGrantsForRole(row.role);

    const principalBase = {
      user: { id: row.userId, role: "user" as string | null },
      memberRole: row.role,
    };
    const fromRoleOnly = { ...principalBase, permissions: undefined };
    const withOverrides = {
      ...principalBase,
      permissions: overrides.map((o) => ({
        action: o.action,
        subject: o.subject,
        effect: (o.effect ?? "allow") as PermissionEffect,
      })),
    };

    const overrideMap = new Map<string, PermissionEffect>();
    for (const o of overrides) {
      overrideMap.set(
        `${o.action}:${o.subject}`,
        (o.effect ?? "allow") as PermissionEffect,
      );
    }

    const effective: EffectiveCell[] = [];
    for (const features of Object.values(FEATURES_BY_DOMAIN)) {
      for (const subject of features) {
        for (const action of PERMISSION_ACTIONS) {
          const key = `${action}:${subject}`;
          effective.push({
            action,
            subject: subject as FeatureSubject,
            fromRole: can(fromRoleOnly, action, subject as FeatureSubject),
            override: overrideMap.get(key) ?? null,
            effective: can(withOverrides, action, subject as FeatureSubject),
          });
        }
      }
    }

    return {
      memberId: row.id,
      role: row.role,
      templateGrants,
      overrides,
      effective,
    };
  }

  assertOrgAdmin(
    memberRole: string | null | undefined,
    platformRole?: string | null,
  ) {
    if (String(platformRole ?? "").toLowerCase() === "admin") return;
    const role = String(memberRole ?? "").toLowerCase();
    if (role !== "owner" && role !== "admin") {
      throw new ForbiddenException("Organization admin required");
    }
  }

  private async mapStoreError<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.startsWith("Invalid ")) {
        throw new BadRequestException(message);
      }
      if (message.startsWith("Duplicate grant:")) {
        throw new BadRequestException(message);
      }
      if (message.includes("not found in organization")) {
        throw new NotFoundException(message);
      }
      throw error;
    }
  }
}
