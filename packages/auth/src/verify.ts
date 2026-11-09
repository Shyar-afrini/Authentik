import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

export type AccessTokenClaims = JWTPayload & {
  /** Space-separated OAuth scopes. */
  scope?: string;
  role?: string | null;
  orgs?: { id: string; role: string }[];
  /** Application the token is for and the user's grants in it, keyed by organization id. */
  app?: string;
  grants?: Record<string, { action: string; subject: string; effect?: "allow" | "deny" }[]>;
  grantsTruncated?: boolean;
  /** OAuth client the token was issued to. */
  azp?: string;
};

export type TokenVerifierOptions = {
  /** Auth server origin, e.g. `https://auth.example.com`. JWKS is read from `/api/auth/jwks`. */
  authUrl: string;
  /** Expected `iss`. Defaults to `authUrl/api/auth`, the issuer Better Auth publishes. */
  issuer?: string;
  /** Expected `aud` (this API's identifier). Omit only for first-party setups. */
  audience?: string;
};

/**
 * Offline access-token check for any project: signature, expiry, issuer and audience are verified
 * against the auth server's cached JWKS, so no per-request call to the auth server is needed.
 */
export function createTokenVerifier(options: TokenVerifierOptions) {
  const base = options.authUrl.replace(/\/$/, "");
  const jwks = createRemoteJWKSet(new URL(`${base}/api/auth/jwks`), {
    cooldownDuration: 30_000,
    cacheMaxAge: 10 * 60_000,
  });
  const issuer = options.issuer ?? `${base}/api/auth`;
  return async function verifyAccessToken(token: string): Promise<AccessTokenClaims> {
    const { payload } = await jwtVerify(token, jwks, {
      issuer,
      ...(options.audience ? { audience: options.audience } : {}),
    });
    return payload as AccessTokenClaims;
  };
}

/** A token minted for one application's audience must not be accepted by another application. */
export function tokenBelongsToApp(claims: AccessTokenClaims, app: string): boolean {
  return claims.app === app;
}

export function hasScope(claims: AccessTokenClaims, scope: string): boolean {
  return (claims.scope ?? "").split(" ").includes(scope);
}
