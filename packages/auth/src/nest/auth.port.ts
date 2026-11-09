export type MemberPermissionRow = {
  action: string;
  subject: string;
  effect?: "allow" | "deny";
};

export type AuthSession = {
  session: {
    activeOrganizationId?: string | null;
  } & Record<string, unknown>;
  user: {
    id: string;
    email?: string | null;
    name?: string | null;
    role?: string | null;
  } & Record<string, unknown>;
  /** Active org membership id when resolved from auth DB. */
  memberId?: string | null;
  /** Org membership role when known (owner | admin | member). */
  memberRole?: string | null;
  /** Extra grants loaded from member_permission (deny overrides allow). */
  permissions?: MemberPermissionRow[];
  /** Branches this member is limited to. Absent or empty means every branch. */
  branchIds?: string[];
  /** Organization the server resolved membership for (the requested one, else the session's). */
  resolvedOrganizationId?: string | null;
  /** False when the organization has no entitlement to the calling application. */
  entitled?: boolean;
};

/**
 * Host-provided auth adapter. Domain Nest packages never import Better Auth
 * internals — they call this port (usually createNexusAuthPort from @authentik/auth).
 */
export type NexusAuthPort = {
  getSession(init: {
    cookie?: string | null;
    authorization?: string | null;
    /** Application whose grants to load; defaults to `nexus`. */
    appKey?: string | null;
    /** Organization to resolve membership for (`x-organization-id`); defaults to the session's. */
    organizationId?: string | null;
  }): Promise<AuthSession | null>;
};

/**
 * - `none` — no APP_GUARD
 * - `header` — require `x-user-id` (dev / no Better Auth peer)
 * - `port` — Better Auth (or compatible) session via cookie / Authorization
 */
export type NexusAuthMode = "none" | "header" | "port";

export type NexusAuthOptions = {
  mode?: NexusAuthMode;
  /** Required when mode is `port`. */
  port?: NexusAuthPort;
  /** Header used in `header` mode. Default `x-user-id`. */
  userIdHeader?: string;
};

export const NEXUS_AUTH = Symbol("NEXUS_AUTH");

export const DEFAULT_NEXUS_AUTH: Required<
  Pick<NexusAuthOptions, "mode" | "userIdHeader">
> &
  NexusAuthOptions = {
  mode: "header",
  userIdHeader: "x-user-id",
};

/**
 * `header` mode trusts a client-supplied user id and grants admin. It is only for
 * local development or a trusted gateway; production must opt in explicitly.
 */
function assertHeaderModeAllowed(mode: NexusAuthMode | undefined) {
  if (mode !== "header") return;
  if (process.env.NODE_ENV !== "production") return;
  if (process.env.AUTHENTIK_ALLOW_HEADER_AUTH === "1") return;
  throw new Error(
    "Nexus auth mode `header` is disabled in production (it trusts any x-user-id and grants admin). " +
      "Configure auth: { mode: 'port', port } or, behind a trusted gateway only, set AUTHENTIK_ALLOW_HEADER_AUTH=1.",
  );
}

export function resolveNexusAuth(options?: NexusAuthOptions | false): NexusAuthOptions {
  if (options === false) {
    return { mode: "none" };
  }
  const resolved: NexusAuthOptions = !options
    ? { ...DEFAULT_NEXUS_AUTH }
    : {
        ...DEFAULT_NEXUS_AUTH,
        ...options,
        mode: options.mode ?? DEFAULT_NEXUS_AUTH.mode,
        userIdHeader: options.userIdHeader ?? DEFAULT_NEXUS_AUTH.userIdHeader,
      };
  assertHeaderModeAllowed(resolved.mode);
  return resolved;
}
