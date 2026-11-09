import { Body, Controller, Get, Inject, Param, Patch, Post, Put, Req } from "@nestjs/common";
import { createAbilityFor } from "@authentik/auth";
import { MEMBER_ROLES } from "@authentik/auth/permissions";
import type { AuthSession } from "@authentik/auth/nest";
import { count } from "drizzle-orm";
import type { Request } from "express";
import { APP_KEY_HEADER, AUTHENTIK_APP, resolveCallerApp } from "../applications/app-keys.js";
import { header } from "../common/principal.service.js";
import { requestContext } from "../common/request-context.js";
import { APP_CONFIG, type AppConfig } from "../config/env.js";
import { AuthDB } from "../database/index.js";
import { organization } from "../database/schema/organization.js";
import { ensureOrgMember } from "../organizations/org-bootstrap.js";
import { setEntitlement } from "../organizations/entitlements.js";
import { SessionService } from "../sessions/session.service.js";
import { AdminError, ForbiddenException } from "./errors.js";
import { MembersService } from "./members.js";
import { MemberPermissionsService } from "./permissions.js";

type Json = Record<string, unknown>;

/**
 * Member and permission admin console for the Nexus application (`/api/v1/auth/*`).
 * It is signed-in-user authority (browsers cannot hold a secret), so an application key is not
 * needed, but another application's key must not be presented here.
 */
@Controller("api/v1/auth")
export class MembersController {
  private readonly members = new MembersService();
  private readonly permissions = new MemberPermissionsService();

  constructor(
    private readonly sessions: SessionService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /** Single-tenant hosts serve one organization: AUTHENTIK_ORGANIZATION_ID, else the only one that exists. */
  private async singleTenantOrg(): Promise<string | undefined> {
    const fromEnv = process.env.AUTHENTIK_ORGANIZATION_ID?.trim();
    if (fromEnv) return fromEnv;
    const rows = await AuthDB.select({ id: organization.id }).from(organization).limit(2);
    return rows.length === 1 ? rows[0].id : undefined;
  }

  /**
   * Same resolution as the client AuthGuard: the organization comes from `x-organization-id`,
   * else the session, else the single-tenant org; a request without membership fails closed.
   */
  private async principal(req: Request, bootstrap = false): Promise<AuthSession> {
    const presented = header(req, APP_KEY_HEADER);
    if (presented && (await resolveCallerApp({ key: presented })) !== AUTHENTIK_APP) {
      throw new AdminError(403, "app_mismatch", "This key belongs to a different application");
    }
    const requested = header(req, "x-organization-id");
    const raw = await this.sessions.getSession({
      cookie: header(req, "cookie"),
      authorization: header(req, "authorization"),
      appKey: AUTHENTIK_APP,
      organizationId: requested ?? (this.config.singleTenant ? await this.singleTenantOrg() : undefined),
    });
    if (!raw?.user?.id) throw new AdminError(401, "unauthorized", "Authentication required");
    const ctx = requestContext();
    if (ctx) ctx.actorUserId = String(raw.user.id);

    const organizationId = raw.resolvedOrganizationId ?? null;
    const platformAdmin = String(raw.user.role ?? "").toLowerCase() === "admin";
    // Organization bootstrap by a platform admin is the one call allowed before any membership exists.
    const bootstrapping = bootstrap && platformAdmin;
    if (organizationId && !raw.memberRole && !this.config.singleTenant && !bootstrapping) {
      throw new ForbiddenException(`Not a member of organization ${organizationId}`);
    }
    if (organizationId && !bootstrapping && !raw.entitled) {
      throw new ForbiddenException("This organization is not entitled to this application");
    }
    return {
      ...raw,
      session: { ...raw.session, activeOrganizationId: organizationId },
      memberRole: raw.memberRole ?? (this.config.singleTenant ? "owner" : "member"),
    };
  }

  private requireAdmin(auth: AuthSession) {
    if (!createAbilityFor(auth).can("manage", "Organization")) throw new ForbiddenException("Organization admin required");
    this.members.assertOrgAdmin(auth.memberRole, auth.user?.role);
  }

  private orgOf(auth: AuthSession): string {
    return this.members.requireOrganizationId(auth.session.activeOrganizationId);
  }

  /** Authenticates and requires an organization admin; returns the caller and their organization. */
  private async admin(req: Request) {
    const auth = await this.principal(req);
    this.requireAdmin(auth);
    return { auth, org: this.orgOf(auth) };
  }

  @Get("me")
  async me(@Req() req: Request) {
    const auth = await this.principal(req);
    return {
      user: { id: auth.user.id, email: auth.user.email ?? null, name: auth.user.name ?? null, role: auth.user.role ?? null },
      memberId: auth.memberId ?? null,
      memberRole: auth.memberRole ?? null,
      permissions: auth.permissions ?? [],
      activeOrganizationId: auth.session.activeOrganizationId ?? null,
    };
  }

  @Get("user-names")
  async userNames(@Req() req: Request) {
    return this.members.userNames(this.orgOf(await this.principal(req)));
  }

  @Get("member-roles")
  async roles(@Req() req: Request) {
    await this.admin(req);
    return { roles: MEMBER_ROLES };
  }

  @Get("permission-catalog")
  async catalog(@Req() req: Request) {
    await this.admin(req);
    return this.permissions.catalog();
  }

  @Post("organization/ensure")
  async ensureOrganization(@Req() req: Request, @Body() input: Json) {
    const auth = await this.principal(req, true);
    this.requireAdmin(auth);
    const organizationId = this.orgOf(auth);
    const org = await this.members.ensureOrganization(organizationId, {
      name: typeof input?.name === "string" ? input.name : undefined,
      slug: typeof input?.slug === "string" ? input.slug : undefined,
    });
    const platformAdmin = String(auth.user.role ?? "").toLowerCase() === "admin";
    // Attach the caller as owner if they have no membership yet (bootstrap).
    await ensureOrgMember({ organizationId, userId: String(auth.user.id), role: platformAdmin ? "owner" : (auth.memberRole ?? "owner") });
    // A platform admin creating the organization from the desk also enables this application for it.
    if (platformAdmin) await setEntitlement(organizationId, AUTHENTIK_APP, true, String(auth.user.id));
    return org;
  }

  @Get("members")
  async list(@Req() req: Request) {
    const { org } = await this.admin(req);
    return this.members.list(org);
  }

  @Post("members")
  async create(@Req() req: Request, @Body() input: Json) {
    const { org } = await this.admin(req);
    return this.members.create(org, input as never);
  }

  @Patch("members/:id")
  async patch(@Req() req: Request, @Param("id") id: string, @Body() input: Json) {
    const { org } = await this.admin(req);
    return this.members.patch(org, id, input as never);
  }

  @Post("members/:id/reset-password")
  async resetPassword(@Req() req: Request, @Param("id") id: string, @Body() input: Json) {
    const { org } = await this.admin(req);
    return this.members.resetPassword(org, id, String(input?.password ?? ""));
  }

  @Get("members/:id/permissions/effective")
  async effective(@Req() req: Request, @Param("id") id: string) {
    const { org } = await this.admin(req);
    return this.permissions.effectiveForMember(id, org);
  }

  @Get("members/:id/permissions")
  async listPermissions(@Req() req: Request, @Param("id") id: string) {
    const { org } = await this.admin(req);
    return this.permissions.listForMember(id, org);
  }

  @Put("members/:id/permissions")
  async replacePermissions(@Req() req: Request, @Param("id") id: string, @Body() input: Json) {
    const { org } = await this.admin(req);
    const list = Array.isArray(input?.permissions) ? input.permissions : [];
    return this.permissions.replaceForMember(id, org, list as never);
  }

  @Get("members/:id/branches")
  async listBranches(@Req() req: Request, @Param("id") id: string) {
    const { org } = await this.admin(req);
    return { branchIds: await this.permissions.listBranchesForMember(id, org) };
  }

  @Put("members/:id/branches")
  async replaceBranches(@Req() req: Request, @Param("id") id: string, @Body() input: Json) {
    const { org } = await this.admin(req);
    return { branchIds: await this.permissions.replaceBranchesForMember(id, org, input?.branchIds ?? []) };
  }
}
