import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Req } from "@nestjs/common";
import type { Request } from "express";
import { AuthDB } from "../database/index.js";
import { recordAuditBestEffort } from "../audit/audit.js";
import { PrincipalService } from "../common/principal.service.js";
import { isUuid } from "../common/uuid.js";
import { BadRequestException, ForbiddenException, NotFoundException } from "../members/errors.js";
import { lookupMemberContext } from "../members/member-lookup.js";
import { listAppGrants, replaceAppGrants } from "../applications/registry.js";
import { listOrgAppDetails, listOrgApps, parseClientTypes, setEntitlement } from "./entitlements.js";
import { getOrgSettings, parseSettingsPatch, updateOrgSettings } from "./settings.js";
import { ensureAuthOrganization, ensureOrgMember } from "./org-bootstrap.js";

const MEMBER_ROLES = new Set(["owner", "admin", "member"]);

/** Client provisioning: organizations, which applications they may reach, who belongs. Platform admin only, except grants. */
@Controller("api/nexus/orgs")
export class OrganizationsController {
  constructor(private readonly principal: PrincipalService) {}

  @Get()
  async list(@Req() req: Request) {
    await this.principal.requirePlatformAdmin(req);
    return AuthDB.execute<{ id: string; name: string; slug: string; created_at: string; apps: string[]; members: number }>(sql`
      select o.id, o.name, o.slug, o.created_at,
        coalesce((select array_agg(oa.application_id order by oa.application_id) from auth.organization_application oa where oa.organization_id = o.id), '{}') as apps,
        (select count(*)::int from auth.member m where m.organization_id = o.id) as members
      from auth.organization o order by o.created_at desc limit 500`);
  }

  @Get(":org")
  async detail(@Req() req: Request, @Param("org") org: string) {
    await this.authorizeOrgAdmin(req, org);
    const [row] = await AuthDB.execute<{ id: string; name: string; slug: string }>(sql`select id, name, slug from auth.organization where id = ${org}`);
    if (!row) throw new NotFoundException("Organization not found");
    const members = await AuthDB.execute(sql`
      select m.id as "memberId", m.user_id as "userId", m.role, u.email, u.name
      from auth.member m join auth."user" u on u.id = m.user_id
      where m.organization_id = ${org} order by u.email limit 500`);
    return { ...row, apps: await listOrgAppDetails(org), settings: await getOrgSettings(org), members };
  }

  @Post()
  async create(@Req() req: Request, @Body() body: { id?: string; name?: string; slug?: string; apps?: (string | { app: string; clientTypes?: string[] })[] }) {
    const who = await this.principal.requirePlatformAdmin(req);
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name || name.length > 120) throw new BadRequestException("name is required (max 120 characters)");
    const id = body.id?.trim() || randomUUID();
    if (!isUuid(id)) throw new BadRequestException("id must be a uuid");
    // Parse every entry before writing so a bad one does not leave a half-provisioned organization.
    const entries = (Array.isArray(body.apps) ? body.apps : []).map((a) =>
      typeof a === "string" ? { app: a, clientTypes: undefined } : { app: String(a?.app ?? ""), clientTypes: parseClientTypes(a?.clientTypes) },
    ).filter((e) => e.app);
    const org = await ensureAuthOrganization({ organizationId: id, name, slug: body.slug });
    for (const e of entries) await setEntitlement(org.id, e.app, true, who.userId, e.clientTypes);
    const apps = entries.map((e) => e.app);
    await recordAuditBestEffort({ action: "org.created", resourceType: "organization", resourceId: org.id, organizationId: org.id, actorUserId: who.userId, diff: { name, apps } });
    return { id: org.id, name: org.name, slug: org.slug, apps };
  }

  @Patch(":org")
  async rename(@Req() req: Request, @Param("org") org: string, @Body() body: { name?: string }) {
    const who = await this.principal.requirePlatformAdmin(req);
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name || name.length > 120) throw new BadRequestException("name is required (max 120 characters)");
    const [row] = await AuthDB.execute<{ id: string; name: string; slug: string }>(sql`update auth.organization set name = ${name} where id = ${org} returning id, name, slug`);
    if (!row) throw new NotFoundException("Organization not found");
    await recordAuditBestEffort({ action: "org.renamed", resourceType: "organization", resourceId: org, organizationId: org, actorUserId: who.userId, diff: { name } });
    return row;
  }

  /** Cascades to members, entitlements and settings; the audit row stays (it has no foreign key). */
  @Delete(":org")
  @HttpCode(204)
  async remove(@Req() req: Request, @Param("org") org: string) {
    const who = await this.principal.requirePlatformAdmin(req);
    if (!isUuid(org)) throw new NotFoundException("Organization not found");
    const deleted = await AuthDB.execute<{ id: string }>(sql`delete from auth.organization where id = ${org} returning id`);
    if (!deleted.length) throw new NotFoundException("Organization not found");
    await recordAuditBestEffort({ action: "org.deleted", resourceType: "organization", resourceId: org, organizationId: org, actorUserId: who.userId });
  }

  @Delete(":org/members/:userId")
  @HttpCode(204)
  async removeMember(@Req() req: Request, @Param("org") org: string, @Param("userId") userId: string) {
    const who = await this.principal.requirePlatformAdmin(req);
    if (!isUuid(org) || !isUuid(userId)) throw new NotFoundException("Member not found");
    const deleted = await AuthDB.execute<{ id: string }>(sql`delete from auth.member where organization_id = ${org} and user_id = ${userId} returning id`);
    if (!deleted.length) throw new NotFoundException("Member not found");
    await recordAuditBestEffort({ action: "org.member_removed", resourceType: "member", resourceId: deleted[0].id, organizationId: org, actorUserId: who.userId });
  }

  @Get(":org/apps")
  async apps(@Req() req: Request, @Param("org") org: string) {
    await this.principal.requirePlatformAdmin(req);
    return { apps: await listOrgApps(org), details: await listOrgAppDetails(org) };
  }

  @Put(":org/apps/:app")
  async grantApp(@Req() req: Request, @Param("org") org: string, @Param("app") app: string, @Body() body: { clientTypes?: string[] }) {
    const who = await this.principal.requirePlatformAdmin(req);
    await setEntitlement(org, app, true, who.userId, body?.clientTypes === undefined ? undefined : parseClientTypes(body.clientTypes));
    return { apps: await listOrgApps(org), details: await listOrgAppDetails(org) };
  }

  @Delete(":org/apps/:app")
  async revokeApp(@Req() req: Request, @Param("org") org: string, @Param("app") app: string) {
    const who = await this.principal.requirePlatformAdmin(req);
    await setEntitlement(org, app, false, who.userId);
    return { apps: await listOrgApps(org) };
  }

  @Put(":org/members/:userId")
  async setMember(@Req() req: Request, @Param("org") org: string, @Param("userId") userId: string, @Body() body: { role?: string }) {
    const who = await this.principal.requirePlatformAdmin(req);
    const role = body?.role ?? "member";
    if (!MEMBER_ROLES.has(role)) throw new BadRequestException("role must be owner, admin or member");
    const row = await ensureOrgMember({ organizationId: org, userId, role, setRole: true });
    await recordAuditBestEffort({ action: "org.member_set", resourceType: "member", resourceId: row.id, organizationId: row.organizationId, actorUserId: who.userId, diff: { role } });
    return { memberId: row.id, role: row.role };
  }

  @Get(":org/settings")
  async settings(@Req() req: Request, @Param("org") org: string) {
    await this.authorizeOrgAdmin(req, org);
    return getOrgSettings(org);
  }

  @Put(":org/settings")
  async putSettings(@Req() req: Request, @Param("org") org: string, @Body() body: unknown) {
    const who = await this.authorizeOrgAdmin(req, org);
    return updateOrgSettings(org, parseSettingsPatch(body), who.userId);
  }

  /** Platform admin, or an owner/admin of this organization (tenancy: nobody else touches its members' grants). */
  private async authorizeOrgAdmin(req: Request, org: string) {
    const who = await this.principal.require(req);
    if (who.platformAdmin) return who;
    const membership = await lookupMemberContext(who.userId, org);
    if (!membership || !["owner", "admin"].includes(membership.role)) throw new ForbiddenException("Insufficient privileges");
    return who;
  }

  @Get(":org/members/:memberId/apps/:app/grants")
  async grants(@Req() req: Request, @Param("org") org: string, @Param("memberId") memberId: string, @Param("app") app: string) {
    await this.authorizeOrgAdmin(req, org);
    return { grants: await listAppGrants(memberId, org, app) };
  }

  @Put(":org/members/:memberId/apps/:app/grants")
  async putGrants(@Req() req: Request, @Param("org") org: string, @Param("memberId") memberId: string, @Param("app") app: string, @Body() body: { grants?: never }) {
    await this.authorizeOrgAdmin(req, org);
    return { grants: await replaceAppGrants(memberId, org, app, body?.grants ?? []) };
  }
}
