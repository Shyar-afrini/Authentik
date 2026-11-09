import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "./errors.js";
import { hashPassword } from "better-auth/crypto";
import { and, eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getOrgSettings } from "../organizations/settings.js";
import { recordAudit } from "../audit/audit.js";
import { AuthDB } from "../database/index.js";
import { account, user } from "../database/schema/user.js";
import { member } from "../database/schema/organization.js";
import {
  ensureAuthOrganization,
  ensureOrgMember,
} from "../organizations/org-bootstrap.js";
import {
  MEMBER_ROLES,
  isMemberRole,
  type MemberRole,
} from "@authentik/auth/permissions";

export type MemberListItem = {
  memberId: string;
  userId: string;
  email: string;
  name: string;
  role: string;
  platformRole: string | null;
  createdAt: Date;
  employeeId: string | null;
  employeeName: string | null;
  employeeNumber: string | null;
};

export type CreateMemberInput = {
  email: string;
  name: string;
  password: string;
  role: string;
  employeeId?: string | null;
};

export type PatchMemberInput = {
  role?: string;
  employeeId?: string | null;
};

export class MembersService {
  assertOrgAdmin(memberRole: string | null | undefined, platformRole?: string | null) {
    if (String(platformRole ?? "").toLowerCase() === "admin") return;
    const role = String(memberRole ?? "").toLowerCase();
    if (role !== "owner" && role !== "admin") {
      throw new ForbiddenException("Organization admin required");
    }
  }

  requireOrganizationId(organizationId: string | null | undefined): string {
    const id = organizationId?.trim();
    if (!id) {
      throw new BadRequestException("activeOrganizationId required");
    }
    return id;
  }

  async ensureOrganization(
    organizationId: string,
    opts?: { name?: string; slug?: string },
  ) {
    return ensureAuthOrganization({
      organizationId,
      name: opts?.name,
      slug: opts?.slug,
    });
  }

  /** Display names of the organization's users, for screens that show who did something (no email or role). */
  async userNames(organizationId: string): Promise<{ id: string; name: string }[]> {
    const rows = await AuthDB.select({ id: user.id, name: user.name })
      .from(member)
      .innerJoin(user, eq(user.id, member.userId))
      .where(eq(member.organizationId, organizationId));
    return rows.map((r) => ({ id: r.id, name: r.name }));
  }

  async list(organizationId: string): Promise<MemberListItem[]> {
    await this.ensureOrganization(organizationId);

    const rows = await AuthDB.select({
      memberId: member.id,
      userId: member.userId,
      role: member.role,
      createdAt: member.createdAt,
      email: user.email,
      name: user.name,
      platformRole: user.role,
    })
      .from(member)
      .innerJoin(user, eq(user.id, member.userId))
      .where(eq(member.organizationId, organizationId));

    const userIds = rows.map((r) => r.userId);
    const employeeByUser = await this.loadEmployeesByUserIds(
      organizationId,
      userIds,
    );

    return rows.map((r) => {
      const emp = employeeByUser.get(r.userId);
      return {
        memberId: r.memberId,
        userId: r.userId,
        email: r.email,
        name: r.name,
        role: r.role,
        platformRole: r.platformRole,
        createdAt: r.createdAt,
        employeeId: emp?.id ?? null,
        employeeName: emp?.name ?? null,
        employeeNumber: emp?.employeeNumber ?? null,
      };
    });
  }

  async create(
    organizationId: string,
    input: CreateMemberInput,
  ): Promise<MemberListItem> {
    await this.ensureOrganization(organizationId);
    const role = this.parseRole(input.role);
    const email = input.email.trim().toLowerCase();
    const name = input.name.trim();
    const password = input.password;

    if (!email || !name) {
      throw new BadRequestException("email and name are required");
    }
    const minLength = (await getOrgSettings(organizationId)).passwordMinLength;
    if (!password || password.length < minLength) {
      throw new BadRequestException(`password must be at least ${minLength} characters`);
    }

    const [existingUser] = await AuthDB.select({ id: user.id })
      .from(user)
      .where(eq(user.email, email))
      .limit(1);
    if (existingUser) {
      throw new ConflictException("A user with this email already exists");
    }

    const createdUserId = randomUUID();
    const now = new Date();
    const hashed = await hashPassword(password);

    // User, credential, membership and audit row commit together.
    await AuthDB.transaction(async (tx) => {
      await tx.insert(user).values({
        id: createdUserId,
        name,
        email,
        emailVerified: false,
        role: "user",
        createdAt: now,
        updatedAt: now,
      });
      await tx.insert(account).values({
        id: randomUUID(),
        accountId: createdUserId,
        providerId: "credential",
        userId: createdUserId,
        password: hashed,
        createdAt: now,
        updatedAt: now,
      });
      await ensureOrgMember({ organizationId, userId: createdUserId, role }, tx);
      await recordAudit(tx, {
        action: "member.created",
        resourceType: "user",
        resourceId: createdUserId,
        organizationId,
        diff: { email, name, role },
      });
    });

    if (input.employeeId) {
      await this.linkEmployee(organizationId, input.employeeId, createdUserId);
    }

    const listed = await this.list(organizationId);
    const row = listed.find((m) => m.userId === createdUserId);
    if (!row) throw new NotFoundException("Created member not found");
    return row;
  }

  async patch(
    organizationId: string,
    memberId: string,
    input: PatchMemberInput,
  ): Promise<MemberListItem> {
    await this.ensureOrganization(organizationId);
    const row = await this.getMemberOrThrow(organizationId, memberId);

    if (input.role !== undefined) {
      const role = this.parseRole(input.role);
      await AuthDB.transaction(async (tx) => {
        await tx.update(member).set({ role }).where(eq(member.id, memberId));
        await recordAudit(tx, {
          action: "member.role_changed",
          resourceType: "member",
          resourceId: memberId,
          organizationId,
          diff: { before: row.role, after: role },
        });
      });
    }

    if (input.employeeId !== undefined) {
      if (input.employeeId === null || input.employeeId === "") {
        await this.unlinkEmployeeByUserId(organizationId, row.userId);
      } else {
        await this.linkEmployee(organizationId, input.employeeId, row.userId);
      }
      // The HRM link is a raw cross-schema write outside the member transaction.
      await recordAudit(AuthDB, {
        action: "member.employee_link_changed",
        resourceType: "member",
        resourceId: memberId,
        organizationId,
        diff: { employeeId: input.employeeId || null },
      });
    }

    const listed = await this.list(organizationId);
    const updated = listed.find((m) => m.memberId === memberId);
    if (!updated) throw new NotFoundException("Member not found");
    return updated;
  }

  async resetPassword(
    organizationId: string,
    memberId: string,
    newPassword: string,
  ) {
    await this.ensureOrganization(organizationId);
    const minLength = (await getOrgSettings(organizationId)).passwordMinLength;
    if (!newPassword || newPassword.length < minLength) {
      throw new BadRequestException(`password must be at least ${minLength} characters`);
    }
    const row = await this.getMemberOrThrow(organizationId, memberId);
    const hashed = await hashPassword(newPassword);

    await AuthDB.transaction(async (tx) => {
      const [cred] = await tx
        .select({ id: account.id })
        .from(account)
        .where(and(eq(account.userId, row.userId), eq(account.providerId, "credential")))
        .limit(1);

      if (cred) {
        await tx
          .update(account)
          .set({ password: hashed, updatedAt: new Date() })
          .where(eq(account.id, cred.id));
      } else {
        await tx.insert(account).values({
          id: randomUUID(),
          accountId: row.userId,
          providerId: "credential",
          userId: row.userId,
          password: hashed,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
      await recordAudit(tx, {
        action: "member.password_reset",
        resourceType: "user",
        resourceId: row.userId,
        organizationId,
        diff: { memberId },
      });
    });

    return { ok: true as const };
  }

  private parseRole(role: string): MemberRole {
    const normalized = role.trim().toLowerCase();
    if (!isMemberRole(normalized)) {
      throw new BadRequestException(
        `Invalid role. Expected one of: ${MEMBER_ROLES.join(", ")}`,
      );
    }
    return normalized;
  }

  private async getMemberOrThrow(organizationId: string, memberId: string) {
    const [row] = await AuthDB.select({
      memberId: member.id,
      userId: member.userId,
      role: member.role,
    })
      .from(member)
      .where(
        and(eq(member.id, memberId), eq(member.organizationId, organizationId)),
      )
      .limit(1);
    if (!row) throw new NotFoundException("Member not found in organization");
    return row;
  }

  private async loadEmployeesByUserIds(
    organizationId: string,
    userIds: string[],
  ): Promise<
    Map<string, { id: string; name: string; employeeNumber: string | null }>
  > {
    const map = new Map<
      string,
      { id: string; name: string; employeeNumber: string | null }
    >();
    if (userIds.length === 0) return map;

    try {
      const result = await AuthDB.execute(sql`
        SELECT id, user_id, first_name, last_name, employee_number
        FROM hrm.employees
        WHERE organization_id = ${organizationId}::uuid
          AND user_id = ANY(${userIds}::text[])
      `);
      const rows = Array.isArray(result)
        ? result
        : ((result as { rows?: Array<Record<string, unknown>> }).rows ?? []);
      for (const raw of rows as Array<Record<string, unknown>>) {
        const linkedUserId = String(raw.user_id ?? "");
        if (!linkedUserId) continue;
        const first = String(raw.first_name ?? "").trim();
        const last = String(raw.last_name ?? "").trim();
        const display = `${first} ${last}`.trim() || linkedUserId;
        map.set(linkedUserId, {
          id: String(raw.id),
          name: display,
          employeeNumber:
            raw.employee_number != null ? String(raw.employee_number) : null,
        });
      }
    } catch {
      // HRM schema may be absent in some hosts — list still works without links.
    }
    return map;
  }

  private async linkEmployee(
    organizationId: string,
    employeeId: string,
    userId: string,
  ) {
    try {
      // Clear previous links for this user in the org.
      await AuthDB.execute(sql`
        UPDATE hrm.employees
        SET user_id = NULL, updated_at = NOW()
        WHERE organization_id = ${organizationId}::uuid
          AND user_id = ${userId}
      `);

      const taken = await AuthDB.execute(sql`
        SELECT id, user_id FROM hrm.employees
        WHERE organization_id = ${organizationId}::uuid
          AND id = ${employeeId}::uuid
        LIMIT 1
      `);
      const takenRows =
        (taken as { rows?: Array<Record<string, unknown>> }).rows ??
        (Array.isArray(taken) ? taken : []);
      const emp = takenRows[0] as Record<string, unknown> | undefined;
      if (!emp) {
        throw new NotFoundException("Employee not found");
      }
      if (emp.user_id && String(emp.user_id) !== userId) {
        throw new ConflictException("Employee is already linked to another user");
      }

      await AuthDB.execute(sql`
        UPDATE hrm.employees
        SET user_id = ${userId}, updated_at = NOW()
        WHERE organization_id = ${organizationId}::uuid
          AND id = ${employeeId}::uuid
      `);
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      throw new BadRequestException(
        error instanceof Error
          ? error.message
          : "Failed to link employee (is HRM installed?)",
      );
    }
  }

  private async unlinkEmployeeByUserId(
    organizationId: string,
    userId: string,
  ) {
    try {
      await AuthDB.execute(sql`
        UPDATE hrm.employees
        SET user_id = NULL, updated_at = NOW()
        WHERE organization_id = ${organizationId}::uuid
          AND user_id = ${userId}
      `);
    } catch {
      // ignore missing HRM
    }
  }
}
