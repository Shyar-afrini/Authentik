import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC_KEY } from "./public.decorator.js";
import {
  REQUIRE_ABILITY_KEY,
  type RequireAbilityMeta,
} from "./require-ability.decorator.js";
import type { AuthedRequest } from "./auth.guard.js";
import { can, createAbilityFor } from "./ability.js";

@Injectable()
export class CaslGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const required = this.reflector.getAllAndOverride<RequireAbilityMeta | undefined>(
      REQUIRE_ABILITY_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required) return true;

    const request = context.switchToHttp().getRequest<AuthedRequest>();
    // Keep request.ability in sync for handlers that read it.
    request.ability = request.ability ?? createAbilityFor(request.auth);
    // Use `can()` (not raw ability.can) so feature↔domain inheritance matches desk useCan.
    if (!can(request.auth, required.action, required.subject)) {
      throw new ForbiddenException(
        `Missing ability: ${required.action} ${required.subject}`,
      );
    }
    return true;
  }
}
