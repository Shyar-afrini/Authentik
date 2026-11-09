import { sql } from "drizzle-orm";
import { Controller, Delete, Get, HttpCode, Param, Query, Req } from "@nestjs/common";
import type { Request } from "express";
import { AuthDB } from "../database/index.js";
import { PrincipalService } from "../common/principal.service.js";
import { isUuid } from "../common/uuid.js";
import { NotFoundException } from "../members/errors.js";
import { recordAuditBestEffort } from "./audit.js";

const MAX_ROWS = 1000;

/** Read-only audit trail and active sessions for the dashboard. Platform admin only. */
@Controller("api/nexus")
export class AuditController {
  constructor(private readonly principal: PrincipalService) {}

  /** Newest first; filters narrow in the database, search and paging happen in the dashboard. */
  @Get("audit")
  async audit(@Req() req: Request, @Query("org") org?: string, @Query("action") action?: string, @Query("limit") limit?: string) {
    await this.principal.requirePlatformAdmin(req);
    const rows = Math.min(Math.max(Number(limit) || 500, 1), MAX_ROWS);
    return AuthDB.execute<{
      id: string; at: string; action: string; resource_type: string; resource_id: string | null;
      organization_id: string | null; actor_email: string | null; ip: string | null; diff: unknown;
    }>(sql`
      select a.id, a.at, a.action, a.resource_type, a.resource_id, a.organization_id, u.email as actor_email, a.ip, a.diff
      from auth.audit_log a left join auth."user" u on u.id = a.actor_user_id
      where (${org && isUuid(org) ? sql`a.organization_id = ${org}` : sql`true`})
        and (${action ? sql`a.action = ${action}` : sql`true`})
      order by a.at desc limit ${rows}`);
  }

  /** Never returns the session token. */
  @Get("sessions")
  async sessions(@Req() req: Request) {
    await this.principal.requirePlatformAdmin(req);
    return AuthDB.execute<{
      id: string; email: string; name: string; ip: string | null; user_agent: string | null;
      created_at: string; expires_at: string; organization: string | null; impersonated: boolean;
    }>(sql`
      select s.id, u.email, u.name, s.ip_address as ip, s.user_agent, s.created_at at time zone 'UTC' as created_at, s.expires_at at time zone 'UTC' as expires_at,
        o.name as organization, s.impersonated_by is not null as impersonated
      from auth.session s join auth."user" u on u.id = s.user_id
      left join auth.organization o on o.id = s.active_organization_id
      where s.expires_at > now() order by s.created_at desc limit ${MAX_ROWS}`);
  }

  @Delete("sessions/:id")
  @HttpCode(204)
  async revoke(@Req() req: Request, @Param("id") id: string) {
    const who = await this.principal.requirePlatformAdmin(req);
    if (!isUuid(id)) throw new NotFoundException("Session not found");
    const deleted = await AuthDB.execute<{ id: string }>(sql`delete from auth.session where id = ${id} returning id`);
    if (!deleted.length) throw new NotFoundException("Session not found");
    await recordAuditBestEffort({ action: "session.revoked", resourceType: "session", resourceId: id, actorUserId: who.userId });
  }
}
