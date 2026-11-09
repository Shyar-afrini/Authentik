import { Inject, Injectable } from "@nestjs/common";
import type { Request } from "express";
import { AUTH } from "../better-auth/better-auth.module.js";
import type { NexusAuth } from "../better-auth/create-auth.js";
import { AdminError, ForbiddenException } from "../members/errors.js";
import { requestContext } from "./request-context.js";

export type Principal = { userId: string; platformAdmin: boolean };

export function credentialHeaders(req: Request): Headers {
  const headers = new Headers();
  if (req.headers.cookie) headers.set("cookie", req.headers.cookie);
  if (req.headers.authorization) headers.set("authorization", req.headers.authorization);
  return headers;
}

export function header(req: Request, name: string): string | undefined {
  const v = req.headers[name];
  return (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
}

/** Who is calling: the signed-in user behind the cookie / bearer token. */
@Injectable()
export class PrincipalService {
  constructor(@Inject(AUTH) private readonly auth: NexusAuth) {}

  async optional(req: Request): Promise<Principal | null> {
    const session = await this.auth.api.getSession({ headers: credentialHeaders(req) });
    if (!session?.user) return null;
    const ctx = requestContext();
    if (ctx) ctx.actorUserId = session.user.id;
    return { userId: session.user.id, platformAdmin: (session.user as { role?: string | null }).role === "admin" };
  }

  async require(req: Request): Promise<Principal> {
    const who = await this.optional(req);
    if (!who) throw new AdminError(401, "unauthorized", "Sign in required");
    return who;
  }

  async requirePlatformAdmin(req: Request): Promise<Principal> {
    const who = await this.require(req);
    if (!who.platformAdmin) throw new ForbiddenException("Insufficient privileges");
    return who;
  }
}
