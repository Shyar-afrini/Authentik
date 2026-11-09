import { Body, Controller, Inject, Post, Req } from "@nestjs/common";
import type { Request } from "express";
import { recordAuditBestEffort } from "../audit/audit.js";
import { AUTH } from "../better-auth/better-auth.module.js";
import type { NexusAuth } from "../better-auth/create-auth.js";
import { credentialHeaders, PrincipalService } from "../common/principal.service.js";
import { AdminError } from "../members/errors.js";

/** Registers an OAuth client for another project (the provider's own admin API is server-only). */
@Controller("api/nexus/admin/clients")
export class OAuthClientsController {
  constructor(
    @Inject(AUTH) private readonly auth: NexusAuth,
    private readonly principal: PrincipalService,
  ) {}

  @Post()
  async create(@Req() req: Request, @Body() body: Record<string, unknown>) {
    await this.principal.requirePlatformAdmin(req);
    const api = this.auth.api as unknown as {
      adminCreateOAuthClient?: (args: { body: Record<string, unknown>; headers: Headers }) => Promise<unknown>;
    };
    if (!api.adminCreateOAuthClient) throw new AdminError(501, "oidc_disabled", "OIDC provider is not enabled");
    const created = await api.adminCreateOAuthClient({ body, headers: credentialHeaders(req) });
    await recordAuditBestEffort({
      action: "oauth.client_created",
      resourceType: "oauth_client",
      resourceId: String((created as { client_id?: string } | null)?.client_id ?? ""),
      diff: { name: body.client_name ?? null, redirect_uris: body.redirect_uris ?? null },
    });
    return created;
  }
}
