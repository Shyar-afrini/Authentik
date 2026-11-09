import { Controller, Get, Query, Req } from "@nestjs/common";
import type { Request } from "express";
import { APP_KEY_HEADER, resolveCallerApp } from "../applications/app-keys.js";
import { assertAppKey } from "../applications/registry.js";
import { header } from "../common/principal.service.js";
import { requestContext } from "../common/request-context.js";
import { AdminError } from "../members/errors.js";
import { SessionService } from "./session.service.js";

/** The Nexus session for client applications: member, role, grants for the calling app, entitlement. */
@Controller("api/nexus/session")
export class SessionsController {
  constructor(private readonly sessions: SessionService) {}

  @Get()
  async session(@Req() req: Request, @Query("app") claimed?: string, @Query("org") org?: string) {
    if (claimed) assertAppKey(claimed);
    // The application is proven by its key, not by what the caller claims; grants load for that app only.
    const appKey = await resolveCallerApp({ key: header(req, APP_KEY_HEADER), claimed });
    const session = await this.sessions.getSession({
      cookie: req.headers.cookie,
      authorization: req.headers.authorization,
      appKey,
      organizationId: org,
    });
    if (!session) throw new AdminError(401, "unauthorized", "No session");
    const ctx = requestContext();
    if (ctx) ctx.actorUserId = String(session.user.id);
    return session;
  }
}
