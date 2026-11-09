export { AuthModule } from "./auth.module.js";
export { AuthGuard, type AuthedRequest } from "./auth.guard.js";
export { CaslGuard } from "./casl.guard.js";
export { BranchScope, branchInScope, branchScopeCondition, resolveBranchScope } from "./branch-scope.js";
export {
  can,
  canAccessDomain,
  canAccessDomainWith,
  createAbilityFor,
  FEATURES_BY_DOMAIN,
  ROLE_ALIASES,
  ROLE_TEMPLATES,
  resolveRoleTemplateKey,
  type Actions,
  type AppAbility,
  type Subjects,
} from "./ability.js";
export { Public, IS_PUBLIC_KEY } from "./public.decorator.js";
export { CurrentUser, CurrentAuth, CurrentUserId, CurrentOrgId } from "./current-user.decorator.js";
export {
  RequireAbility,
  REQUIRE_ABILITY_KEY,
  type RequireAbilityMeta,
} from "./require-ability.decorator.js";
export {
  NEXUS_AUTH,
  DEFAULT_NEXUS_AUTH,
  resolveNexusAuth,
  type AuthSession,
  type MemberPermissionRow,
  type NexusAuthMode,
  type NexusAuthOptions,
  type NexusAuthPort,
} from "./auth.port.js";
export { StripServerFieldsPipe } from "./strip-server-fields.pipe.js";
