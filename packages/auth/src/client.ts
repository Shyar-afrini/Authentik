export {
  can,
  canAccessDomain,
  canAccessDomainWith,
  createAbilityFor,
  FEATURES_BY_DOMAIN,
  type AbilityPrincipal,
  type Actions,
  type AppAbility,
  type Subjects,
} from "./ability.js";
export type { DomainSubject } from "./permissions/catalog.js";
export { createAuthClient, authClient } from "./auth-client.js";
export { AbilityRouteGate, abilityForPath } from "./route-gate.js";
export {
  useAbility,
  useCan,
  invalidateAbilityCache,
} from "./use-can.js";
