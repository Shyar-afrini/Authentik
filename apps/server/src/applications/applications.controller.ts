import { sql } from "drizzle-orm";
import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Req } from "@nestjs/common";
import type { Request } from "express";
import { AuthDB } from "../database/index.js";
import { header, PrincipalService } from "../common/principal.service.js";
import { recordAuditBestEffort } from "../audit/audit.js";
import { ForbiddenException, NotFoundException } from "../members/errors.js";
import { APP_KEY_HEADER, getAppKeyInfo, issueAppKey, resolveCallerApp, revokeAppKey } from "./app-keys.js";
import { getApplicationRegistry, linkClientToApp, upsertApplication, type RegistryInput } from "./registry.js";

/**
 * Application registry. An application may read and replace its own vocabulary with its key;
 * everything else (keys, client links) is platform admin only.
 */
@Controller("api/nexus/apps/:app")
export class ApplicationsController {
  constructor(private readonly principal: PrincipalService) {}

  private async authorizeRegistry(req: Request, app: string) {
    const presented = header(req, APP_KEY_HEADER);
    if (presented) {
      const caller = await resolveCallerApp({ key: presented, claimed: app });
      if (caller !== app) throw new ForbiddenException("Insufficient privileges");
      return;
    }
    await this.principal.requirePlatformAdmin(req);
  }

  @Get("registry")
  async registry(@Req() req: Request, @Param("app") app: string) {
    await this.authorizeRegistry(req, app);
    return getApplicationRegistry(app);
  }

  @Put("registry")
  async putRegistry(@Req() req: Request, @Param("app") app: string, @Body() body: RegistryInput) {
    await this.authorizeRegistry(req, app);
    await upsertApplication(app, body);
    return getApplicationRegistry(app);
  }

  /** Cascades to its permission vocabulary, roles, keys and organization entitlements. */
  @Delete()
  @HttpCode(204)
  async remove(@Req() req: Request, @Param("app") app: string) {
    const who = await this.principal.requirePlatformAdmin(req);
    // Revoking first also clears the key caches, so a deleted app's key stops working at once.
    await revokeAppKey(app);
    const deleted = await AuthDB.execute<{ id: string }>(sql`delete from auth.application where key = ${app} returning id`);
    if (!deleted.length) throw new NotFoundException("Application not found");
    await recordAuditBestEffort({ action: "app.deleted", resourceType: "application", resourceId: app, actorUserId: who.userId });
  }

  @Get("key")
  async keyInfo(@Req() req: Request, @Param("app") app: string) {
    await this.principal.requirePlatformAdmin(req);
    return getAppKeyInfo(app);
  }

  @Post("key")
  async issueKey(@Req() req: Request, @Param("app") app: string) {
    const who = await this.principal.requirePlatformAdmin(req);
    return issueAppKey(app, who.userId);
  }

  @Delete("key")
  @HttpCode(200)
  async revokeKey(@Req() req: Request, @Param("app") app: string) {
    await this.principal.requirePlatformAdmin(req);
    return { revoked: await revokeAppKey(app) };
  }

  @Put("clients/:clientId")
  @HttpCode(204)
  async linkClient(@Req() req: Request, @Param("app") app: string, @Param("clientId") clientId: string) {
    await this.principal.requirePlatformAdmin(req);
    await linkClientToApp(clientId, app);
  }
}

@Controller("api/nexus/apps")
export class ApplicationsListController {
  constructor(private readonly principal: PrincipalService) {}

  @Get()
  async list(@Req() req: Request) {
    await this.principal.requirePlatformAdmin(req);
    return AuthDB.execute<{ key: string; name: string; audience: string | null; key_hint: string | null; organizations: number; subjects: number }>(sql`
      select a.key, a.name, a.audience,
        (select k.hint from auth.application_key k where k.application_id = a.id and k.revoked_at is null) as key_hint,
        (select count(*)::int from auth.organization_application oa where oa.application_id = a.id) as organizations,
        (select count(*)::int from auth.app_permission_def d where d.application_id = a.id) as subjects
      from auth.application a order by a.name`);
  }
}
