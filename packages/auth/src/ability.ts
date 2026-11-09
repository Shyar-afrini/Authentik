import {
  AbilityBuilder,
  createMongoAbility,
  type MongoAbility,
} from "@casl/ability";
import {
  DOMAIN_SUBJECTS,
  FEATURE_IMPLIES,
  FEATURE_IMPLIES_WRITE,
  FEATURES_BY_DOMAIN,
  ROLE_ALIASES,
  ROLE_TEMPLATES,
  domainForFeature,
  isDomainSubject,
  isFeatureSubject,
  resolveRoleTemplateKey,
  type Actions,
  type DomainSubject,
  type FeatureSubject,
  type PermissionGrant,
  type Subjects,
} from "./permissions/catalog.js";

export type { Actions, Subjects };
export {
  FEATURES_BY_DOMAIN,
  ROLE_ALIASES,
  ROLE_TEMPLATES,
  resolveRoleTemplateKey,
};

/** Minimal principal for CASL checks (Nest AuthSession or client session). */
export type AbilityPrincipal = {
  user?: {
    id?: string | null;
    role?: string | null;
  } | null;
  memberRole?: string | null;
  permissions?: Array<{
    action: string;
    subject: string;
    effect?: "allow" | "deny";
  }>;
};

export type AppAbility = MongoAbility<[Actions, Subjects]>;

const ALL_DOMAINS: DomainSubject[] = [...DOMAIN_SUBJECTS];

type RuleFn = (action: Actions, subject: Subjects) => void;

function expandGrant(
  rule: RuleFn,
  action: Actions,
  subject: Subjects,
): void {
  rule(action, subject);

  if (subject === "all") {
    for (const domain of ALL_DOMAINS) {
      expandGrant(rule, action, domain);
    }
    return;
  }

  if (isDomainSubject(subject) && subject !== "Organization") {
    const features = FEATURES_BY_DOMAIN[subject];
    for (const feature of features) {
      rule(action, feature);
      applyFeatureImplies(rule, action, feature);
    }
    return;
  }

  if (isFeatureSubject(subject)) {
    applyFeatureImplies(rule, action, subject);
  }
}

/** PosSale → Store/Terminal/… : operational features unlock sell-flow companions. */
function applyFeatureImplies(
  rule: RuleFn,
  action: Actions,
  subject: FeatureSubject,
): void {
  const implied = FEATURE_IMPLIES[subject];
  if (implied?.length) {
    for (const other of implied) {
      rule("read", other);
      if (action === "manage") {
        rule("manage", other);
      }
    }
  }

  const writeImplied = FEATURE_IMPLIES_WRITE[subject];
  if (
    writeImplied?.length &&
    (action === "create" || action === "update" || action === "manage")
  ) {
    for (const other of writeImplied) {
      rule("create", other);
      rule("update", other);
      if (action === "manage") {
        rule("manage", other);
      }
    }
  }
}

function applyGrants(
  canRule: RuleFn,
  cannotRule: RuleFn,
  grants: PermissionGrant[],
): void {
  for (const grant of grants) {
    const effect = grant.effect ?? "allow";
    const apply = effect === "deny" ? cannotRule : canRule;
    expandGrant(apply, grant.action, grant.subject);
  }
}

function grantsForMemberRole(memberRole: string): PermissionGrant[] {
  const key = resolveRoleTemplateKey(memberRole);
  const template = ROLE_TEMPLATES[key];
  if (template) return template;

  // Unknown roles: same broad desk access as legacy member.
  return ALL_DOMAINS.map((subject) => ({ action: "manage" as const, subject }));
}

/**
 * Build CASL abilities from a Better Auth / Nest session principal.
 * Platform admin (user.role === "admin") → manage all.
 * Org owner/admin → manage domain subjects (features inherit).
 * Role tags apply catalog templates; permissions override (deny wins).
 */
export function createAbilityFor(
  session: AbilityPrincipal | null | undefined,
): AppAbility {
  const { can: canRule, cannot: cannotRule, build } = new AbilityBuilder<AppAbility>(
    createMongoAbility,
  );

  if (!session?.user?.id) {
    return build();
  }

  const platformRole = String(session.user.role ?? "").toLowerCase();
  if (platformRole === "admin") {
    expandGrant(canRule, "manage", "all");
    return build();
  }

  const memberRole = String(session.memberRole ?? "").toLowerCase();
  // No org membership role yet → no domain grants (Nest always sets memberRole).
  if (!memberRole) {
    return build();
  }

  if (memberRole === "owner" || memberRole === "admin") {
    for (const subject of ALL_DOMAINS) {
      expandGrant(canRule, "manage", subject);
    }
  } else if (memberRole === "member") {
    // Least privilege: read-all desk visibility; writes via matrix overrides.
    for (const subject of ALL_DOMAINS) {
      expandGrant(canRule, "read", subject);
    }
  } else {
    applyGrants(canRule, cannotRule, grantsForMemberRole(memberRole));
  }

  if (session.permissions?.length) {
    const extra: PermissionGrant[] = session.permissions.map((row) => ({
      action: row.action as Actions,
      subject: row.subject as Subjects,
      effect: row.effect,
    }));
    applyGrants(canRule, cannotRule, extra);
  }

  return build();
}

/** Check action/subject including domain → feature inheritance. */
export function can(
  session: AbilityPrincipal | null | undefined,
  action: Actions,
  subject: Subjects,
): boolean {
  const ability = createAbilityFor(session);
  if (ability.can(action, subject)) {
    return true;
  }

  if (isFeatureSubject(subject)) {
    const domain = domainForFeature(subject);
    if (domain) {
      if (ability.can("manage", domain)) return true;
      if (action !== "manage" && ability.can(action, domain)) return true;
    }
  }

  return false;
}

/**
 * Whether the principal should see a desk service for this domain
 * (domain grant or any feature under it).
 */
export function canAccessDomain(
  session: AbilityPrincipal | null | undefined,
  domain: DomainSubject,
): boolean {
  if (can(session, "manage", domain) || can(session, "read", domain)) {
    return true;
  }
  if (domain === "Organization") return false;
  const features = FEATURES_BY_DOMAIN[domain];
  for (const feature of features) {
    if (
      can(session, "manage", feature) ||
      can(session, "read", feature) ||
      can(session, "create", feature) ||
      can(session, "update", feature)
    ) {
      return true;
    }
  }
  return false;
}

/** Same check using a `can(action, subject)` callback (e.g. from `useCan`). */
export function canAccessDomainWith(
  check: (action: Actions, subject: Subjects) => boolean,
  domain: DomainSubject,
): boolean {
  if (check("manage", domain) || check("read", domain)) return true;
  if (domain === "Organization") return false;
  const features = FEATURES_BY_DOMAIN[domain];
  for (const feature of features) {
    if (
      check("manage", feature) ||
      check("read", feature) ||
      check("create", feature) ||
      check("update", feature)
    ) {
      return true;
    }
  }
  return false;
}
