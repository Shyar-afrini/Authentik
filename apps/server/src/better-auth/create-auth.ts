import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { expo } from "@better-auth/expo";
import { oauthProvider } from "@better-auth/oauth-provider";
import { sql } from "drizzle-orm";
import { nextCookies } from "better-auth/next-js";
import {
  admin,
  haveIBeenPwned,
  jwt,
  multiSession,
  openAPI,
  organization,
  twoFactor,
} from "better-auth/plugins";
import { recordAuditBestEffort } from "../audit/audit.js";
import { AuthDB } from "../database/index.js";
import * as schema from "../database/schema/index.js";
import { allOrgOrigins } from "../organizations/settings.js";
import { appKeyForAudience } from "../applications/registry.js";

export type NexusAuth = ReturnType<typeof betterAuth>;

export type AuthUserCreated = {
  id: string;
  email: string;
  name: string;
  createdAt?: Date | string | null;
};

type SecondaryStorage = NonNullable<
  Parameters<typeof betterAuth>[0]["secondaryStorage"]
>;

export type CreateAuthOptions = {
  /** Next.js cookie bridge. Turn off when running outside Next (standalone server). */
  nextCookies?: boolean;
  /** Redis-style store: sessions are read from it and rate limits are counted in it. */
  secondaryStorage?: SecondaryStorage;
  /** Called after a user row is created. Failures are logged, never fail the signup. */
  onUserCreated?: (user: AuthUserCreated) => Promise<void> | void;
  /** Reject known-breached passwords via the HIBP range API (external call; off by default). */
  breachCheck?: boolean;
  /** Name shown in authenticator apps for TOTP enrolment. */
  issuerName?: string;
  /** Parent domain (e.g. `example.com`) so sibling subdomains share the session cookie. */
  cookieDomain?: string;
  /** Seconds a signed session cookie is trusted before re-reading the session store. */
  sessionCookieCacheSeconds?: number;
  /** Reverse-proxy IPs/CIDRs whose X-Forwarded-For hops are skipped when finding the client IP. */
  trustedProxies?: string[];
  /**
   * Run as an OAuth2/OIDC identity provider (JWKS, authorization code + PKCE,
   * client_credentials). Needs migration 0005 and `loginPage`/`consentPage`.
   */
  oidc?: {
    /** Public URL of the sign-in page the authorize endpoint redirects to. */
    loginPage: string;
    /** Public URL of the consent page (skipped for clients registered as trusted). */
    consentPage: string;
    /** Token `iss`; defaults to the Better Auth base URL. */
    issuer?: string;
    /** Rotate signing keys after this many seconds (default 90 days); old keys stay valid for 30 days. */
    keyRotationSeconds?: number;
    accessTokenSeconds?: number;
    /** Extra scopes clients may request, e.g. `nexus:read`. */
    scopes?: string[];
    /**
     * API identifiers (JWT `aud`) tokens may target, e.g. `https://api.example.com`.
     * Without a resource the provider issues opaque tokens that must be introspected.
     * New clients are linked to all of them until the per-app registry (Phase 4) narrows this.
     */
    resources?: string[];
  };
};

const MAX_CLAIM_GRANTS = 300;

/**
 * Grants for the application the token is issued for, per organization. Audience-scoped on purpose:
 * a token for app A never lists what the same user may do in app B. Capped so the JWT stays small;
 * callers that hit the cap should use the session endpoint instead.
 */
async function grantClaims(userId: string, audience: string | undefined) {
  if (!audience) return {};
  const app = await appKeyForAudience(audience);
  if (!app) return {};
  const rows = await AuthDB.execute<{ organization_id: string; action: string; subject: string; effect: string }>(
    sql`select m.organization_id, p.action, p.subject, p.effect
        from auth.member m join auth.member_permission p on p.member_id = m.id
        join auth.organization_application oa on oa.organization_id = m.organization_id and oa.application_id = ${app}
        where m.user_id = ${userId} and p.application_id = ${app}
        limit ${MAX_CLAIM_GRANTS + 1}`,
  );
  const grants: Record<string, { action: string; subject: string; effect: string }[]> = {};
  for (const r of rows.slice(0, MAX_CLAIM_GRANTS)) {
    (grants[r.organization_id] ??= []).push({ action: r.action, subject: r.subject, effect: r.effect });
  }
  return { app, grants, grantsTruncated: rows.length > MAX_CLAIM_GRANTS };
}

/** Organizations and roles the user belongs to, embedded in access tokens (capped for size). */
async function orgClaims(userId: string, audience: string | undefined) {
  const app = audience ? await appKeyForAudience(audience) : undefined;
  // For a known application, only organizations entitled to it are listed.
  const rows = await AuthDB.execute<{ organization_id: string; role: string }>(
    app
      ? sql`select m.organization_id, m.role from auth.member m
            join auth.organization_application oa on oa.organization_id = m.organization_id and oa.application_id = ${app}
            where m.user_id = ${userId} limit 50`
      : sql`select organization_id, role from auth.member where user_id = ${userId} limit 50`,
  );
  return rows.map((r) => ({ id: r.organization_id, role: r.role }));
}

const DEFAULT_TRUSTED_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002",
];

function trustedOrigins(): string[] {
  const extra = (
    process.env.AUTH_TRUSTED_ORIGINS ??
    process.env.WEB_ORIGIN ??
    ""
  )
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  return [...new Set([...DEFAULT_TRUSTED_ORIGINS, ...extra])];
}

/** Better Auth wiring with no Nexus-specific imports; hosts inject events and storage. */
export function createAuth(options: CreateAuthOptions = {}): NexusAuth {
  const withNextCookies = options.nextCookies ?? true;
  const { onUserCreated, secondaryStorage, cookieDomain } = options;
  const cacheSeconds = options.sessionCookieCacheSeconds ?? 0;
  return betterAuth({
    database: drizzleAdapter(AuthDB, {
      provider: "pg",
      schemaName: "auth",
      schema,
    }),
    ...(secondaryStorage
      ? {
          secondaryStorage,
          rateLimit: { enabled: true, storage: "secondary-storage" as const },
        }
      : {}),
    session: {
      // Keep the Postgres copy so admin session listing/revocation keeps working;
      // reads are served from secondaryStorage when present.
      ...(secondaryStorage ? { storeSessionInDatabase: true } : {}),
      ...(cacheSeconds > 0
        ? { cookieCache: { enabled: true, maxAge: cacheSeconds } }
        : {}),
    },
    advanced: {
      // Every auth id is a Postgres uuid, matching the domain schemas that reference them.
      database: { generateId: "uuid" },
      ipAddress: {
        ipAddressHeaders: ["x-forwarded-for"],
        ...(options.trustedProxies?.length
          ? { trustedProxies: options.trustedProxies }
          : {}),
      },
      ...(cookieDomain
        ? { crossSubDomainCookies: { enabled: true, domain: cookieDomain } }
        : {}),
    },
    emailAndPassword: {
      enabled: true,
    },
    // Static origins plus every organization's own application origins (resolved per request, cached).
    trustedOrigins: async () => [...trustedOrigins(), ...(await allOrgOrigins().catch(() => [] as string[]))],
    hooks: {
      // Failed credential attempts leave no database row of their own, so they are recorded here.
      after: createAuthMiddleware(async (ctx) => {
        if (!SIGN_IN_PATHS.has(ctx.path)) return;
        if (!(ctx.context.returned instanceof Error)) return;
        const email = (ctx.body as { email?: unknown } | undefined)?.email;
        void recordAuditBestEffort({
          action: "auth.login_failed",
          resourceType: "user",
          diff: { path: ctx.path, email: typeof email === "string" ? email.toLowerCase() : null },
        });
      }),
    },
    databaseHooks: {
      session: {
        create: {
          after: async (session: { userId: string; ipAddress?: string | null }) => {
            void recordAuditBestEffort({
              action: "auth.login",
              resourceType: "user",
              resourceId: session.userId,
              actorUserId: session.userId,
            });
          },
        },
      },
      user: {
        create: {
          after: async (user: AuthUserCreated) => {
            if (!onUserCreated) return;
            // Fire and forget: an unreachable event bus must not delay or fail the signup.
            void Promise.resolve()
              .then(() => onUserCreated(user))
              .catch((error) =>
                console.error("[@authentik/auth] onUserCreated hook failed", error),
              );
          },
        },
      },
    },
    ...(options.oidc ? { disabledPaths: ["/token"] } : {}),
    plugins: [
      // Lets React Native clients sign in (deep-link origins, cookie handoff).
      expo(),
      organization(),
      admin(),
      openAPI(),
      twoFactor({ issuer: options.issuerName ?? "Nexus" }),
      multiSession(),
      ...(options.breachCheck ? [haveIBeenPwned()] : []),
      ...(options.oidc ? oidcPlugins(options.oidc) : []),
      ...(withNextCookies ? [nextCookies()] : []), // must be last
    ],
  }) as unknown as NexusAuth;
}

const SIGN_IN_PATHS = new Set(["/sign-in/email", "/sign-in/username", "/two-factor/verify-totp"]);

function oidcPlugins(oidc: NonNullable<CreateAuthOptions["oidc"]>) {
  return [
    jwt({
      jwks: {
        rotationInterval: oidc.keyRotationSeconds ?? 90 * 24 * 3600,
        gracePeriod: 30 * 24 * 3600,
      },
      jwt: {
        ...(oidc.issuer ? { issuer: oidc.issuer } : {}),
        expirationTime: `${oidc.accessTokenSeconds ?? 900}s`,
      },
    }),
    oauthProvider({
      loginPage: oidc.loginPage,
      consentPage: oidc.consentPage,
      scopes: ["openid", "profile", "email", "offline_access", ...(oidc.scopes ?? [])],
      accessTokenExpiresIn: oidc.accessTokenSeconds ?? 900,
      ...(oidc.resources?.length
        ? {
            resources: oidc.resources,
            clientRegistrationDefaultResources: oidc.resources,
          }
        : {}),
      // Only platform admins register or change OAuth clients and their M2M scopes.
      clientPrivileges: ({ user }) =>
        (user as { role?: string | null } | undefined)?.role === "admin",
      customAccessTokenClaims: async ({ user, resources }) =>
        user?.id
          ? {
              role: (user as { role?: string | null }).role ?? null,
              orgs: await orgClaims(user.id, resources?.[0]),
              ...(await grantClaims(user.id, resources?.[0])),
            }
          : {},
    }),
  ];
}
