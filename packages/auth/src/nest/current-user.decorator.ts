import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { AuthSession } from "./auth.port.js";
import type { AuthedRequest } from "./auth.guard.js";

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthSession["user"] | undefined => {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    return req.auth?.user;
  },
);

export const CurrentAuth = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthSession | undefined => {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    return req.auth;
  },
);

/** Prefer session user id; fall back to x-user-id for header-mode / legacy clients. */
export const CurrentUserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    if (req.auth?.user?.id) return req.auth.user.id;
    const header = req.headers?.["x-user-id"];
    if (typeof header === "string" && header.trim()) return header.trim();
    if (Array.isArray(header) && typeof header[0] === "string") return header[0].trim();
    return undefined;
  },
);

/** Organization the guard resolved (and verified membership for); never read the raw header in controllers. */
export const CurrentOrgId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const org = req.auth?.session?.activeOrganizationId ?? req.nexusOrganizationId;
    return typeof org === "string" && org.trim() ? org.trim() : undefined;
  },
);
