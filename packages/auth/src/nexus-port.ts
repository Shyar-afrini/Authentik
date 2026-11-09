import { fetchFromAuthServer, remoteAuthUrl } from "./session.js";
import { APP_KEY_HEADER, parseAppKey } from "./app-key.js";
import type { AuthSession, NexusAuthPort } from "./nest/auth.port.js";
import { createTokenVerifier, tokenBelongsToApp, type AccessTokenClaims } from "./verify.js";

const BEARER_JWT = /^Bearer\s+([\w-]+\.[\w-]+\.[\w-]+)$/i;
let tokenVerifier: ReturnType<typeof createTokenVerifier> | undefined;

/** Offline JWT check (AUTHENTIK_URL + AUTH_AUDIENCE); no auth-server round trip per request. */
function verifierFromEnv() {
  const authUrl = remoteAuthUrl();
  const audience = process.env.AUTH_AUDIENCE?.trim();
  if (!authUrl || !audience) return null;
  return (tokenVerifier ??= createTokenVerifier({ authUrl, audience }));
}

function sessionFromClaims(claims: AccessTokenClaims): AuthSession {
  const orgs = claims.orgs ?? [];
  // A token carries every org the user belongs to; it is only unambiguous with exactly one.
  const org = orgs.length === 1 ? orgs[0] : null;
  const isUser = Array.isArray(claims.orgs) || claims.role !== undefined;
  return {
    user: { id: String(claims.sub), role: isUser ? (claims.role ?? null) : "service" },
    session: { activeOrganizationId: org?.id ?? null, clientId: claims.azp ?? null },
    memberId: null,
    memberRole: org?.role ?? null,
    // Truncated grant lists are incomplete, so they are dropped and the role template applies.
    permissions:
      org && !claims.grantsTruncated && claims.grants?.[org.id]?.length
        ? claims.grants[org.id]
        : undefined,
  };
}

const CACHE_TTL_MS = Number(process.env.AUTH_SESSION_CACHE_MS ?? 5_000);
const CACHE_MAX = 500;
const sessionCache = new Map<string, { at: number; value: AuthSession | null }>();

/**
 * Plug into DomainModule.forRoot({ auth: { mode: "port", port } }).
 * Resolves Better Auth sessions from cookie / Authorization headers, through the
 * standalone auth server when AUTHENTIK_URL is set, otherwise in-process.
 */
export function createNexusAuthPort(): NexusAuthPort {
  return {
    async getSession(init) {
      const bearer = BEARER_JWT.exec(init?.authorization ?? "")?.[1];
      const verify = bearer ? verifierFromEnv() : null;
      if (bearer && verify) {
        try {
          const claims = await verify(bearer);
          // With this application's key configured, only tokens minted for this application count.
          const configured = parseAppKey(process.env.AUTHENTIK_APP_KEY?.trim());
          if (configured && !tokenBelongsToApp(claims, configured.app)) return null;
          return sessionFromClaims(claims);
        } catch {
          return null;
        }
      }
      if (remoteAuthUrl()) {
        const headers = new Headers();
        if (init?.cookie) headers.set("cookie", init.cookie);
        if (init?.authorization) headers.set("authorization", init.authorization);
        // Short per-credential cache: one auth-server hop per few seconds, not per request.
        // A revoked session or changed role takes effect within AUTH_SESSION_CACHE_MS.
        // AUTHENTIK_APP_KEY is this application's secret key (nak_...); a bare slug is the legacy, unauthenticated form.
        const configured = process.env.AUTHENTIK_APP_KEY?.trim();
        const secret = configured && parseAppKey(configured) ? configured : null;
        if (secret) headers.set(APP_KEY_HEADER, secret);
        const appKey = secret ? parseAppKey(secret)!.app : (init?.appKey ?? configured);
        const query = new URLSearchParams();
        if (appKey) query.set("app", appKey);
        if (init?.organizationId) query.set("org", init.organizationId);
        const sessionPath = `/api/nexus/session${query.size ? `?${query}` : ""}`;
        const key = `${sessionPath}\n${init?.cookie ?? ""}\n${init?.authorization ?? ""}`;
        const hit = sessionCache.get(key);
        if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;
        const value = await fetchFromAuthServer<AuthSession>(sessionPath, headers);
        if (CACHE_TTL_MS > 0) {
          if (sessionCache.size >= CACHE_MAX) sessionCache.delete(sessionCache.keys().next().value!);
          sessionCache.set(key, { at: Date.now(), value });
        }
        return value;
      }
      throw new Error("AUTHENTIK_URL is not set: point this application at the Authentik server");
    },
  };
}
