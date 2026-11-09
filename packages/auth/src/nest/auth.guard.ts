import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import {
  NEXUS_AUTH,
  type AuthSession,
  type NexusAuthOptions,
} from "./auth.port.js";
import { createAbilityFor, type AppAbility } from "./ability.js";
import { IS_PUBLIC_KEY } from "./public.decorator.js";

export type AuthedRequest = {
  auth?: AuthSession;
  ability?: AppAbility;
  path?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  nexusOrganizationId?: string;
};

/** Exact path segments only, so routes like `/documents` never bypass auth. */
export function isOpenApiPath(path: string): boolean {
  const clean = path.split("?")[0] ?? "";
  return /(^|\/)(docs|docs-json|swagger)(\/|$)/.test(clean);
}

function headerValue(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function firstString(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  return undefined;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(NEXUS_AUTH) private readonly auth: NexusAuthOptions,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthedRequest>();
    if (isOpenApiPath(request.path ?? request.url ?? "")) {
      return true;
    }

    const mode = this.auth.mode ?? "header";

    if (mode === "none") {
      return true;
    }

    if (mode === "header") {
      const headerName = (this.auth.userIdHeader ?? "x-user-id").toLowerCase();
      const userId = headerValue(request.headers[headerName]);
      if (!userId?.trim()) {
        throw new UnauthorizedException(
          `Authentication required (send ${this.auth.userIdHeader ?? "x-user-id"} header)`,
        );
      }
      request.auth = {
        user: { id: userId.trim(), role: "admin" },
        session: {
          activeOrganizationId:
            headerValue(request.headers["x-organization-id"]) ??
            firstString(request.nexusOrganizationId) ??
            null,
        },
        memberRole: "owner",
      };
      request.ability = createAbilityFor(request.auth);
      return true;
    }

    if (!this.auth.port) {
      throw new UnauthorizedException(
        "Auth mode is `port` but no auth.port was provided to AuthModule.forRoot",
      );
    }

    const requestedOrganizationId =
      headerValue(request.headers["x-organization-id"]) ?? firstString(request.nexusOrganizationId) ?? null;
    const raw = await this.auth.port.getSession({
      cookie: headerValue(request.headers.cookie) ?? null,
      authorization: headerValue(request.headers.authorization) ?? null,
      organizationId: requestedOrganizationId,
    });

    if (!raw?.user?.id) {
      throw new UnauthorizedException("Authentication required");
    }

    const session = raw.session ?? {};
    if (raw.entitled === false) {
      throw new ForbiddenException("This organization is not entitled to this application");
    }
    const fromSession =
      typeof session.activeOrganizationId === "string"
        ? session.activeOrganizationId
        : null;
    const fromHeader = headerValue(request.headers["x-organization-id"]) ?? null;
    const fromRequest = firstString(request.nexusOrganizationId);
    const activeOrganizationId =
      fromHeader ?? fromSession ?? fromRequest ?? null;

    // The Authentik server resolves membership, permissions and branch limits for the organization
    // the request asked for (`resolvedOrganizationId`); a token's own organization counts too. Anything
    // else is not a membership, so acting inside an organization fails closed.
    const resolved =
      !!activeOrganizationId &&
      (raw.resolvedOrganizationId === activeOrganizationId || fromSession === activeOrganizationId);
    const memberId = resolved ? (raw.memberId ?? null) : null;
    const memberRole = resolved ? (raw.memberRole ?? null) : null;
    const permissions = resolved ? raw.permissions : undefined;
    const branchIds = resolved ? raw.branchIds : undefined;

    if (activeOrganizationId && !memberRole) {
      throw new ForbiddenException(
        `Not a member of organization ${activeOrganizationId}`,
      );
    }

    request.auth = {
      user: {
        id: String(raw.user.id),
        email: raw.user.email ?? null,
        name: raw.user.name ?? null,
        role: (raw.user as { role?: string | null }).role ?? null,
      },
      session: {
        ...session,
        activeOrganizationId,
      },
      memberId,
      memberRole: memberRole ?? "member",
      permissions,
      branchIds,
    };
    request.ability = createAbilityFor(request.auth);
    return true;
  }
}
