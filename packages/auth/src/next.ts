import { headers } from "next/headers.js";
import { APP_KEY_HEADER } from "./app-key.js";
import { fetchFromAuthServer } from "./session.js";
import type { AuthSession } from "./nest/auth.port.js";

export type NextAuthConfig = {
  /** Base URL of the Authentik server. Defaults to AUTHENTIK_URL. */
  authUrl?: string;
  /** This application's key (server-side only, never NEXT_PUBLIC_). Defaults to AUTHENTIK_APP_KEY. */
  appKey?: string;
  /** Application id as registered on the auth server. */
  app: string;
};

/**
 * Server-side session for a Next.js app: who is signed in, their role and grants for this
 * application in the organization they are acting in, and whether it is entitled to the app.
 * Returns null when nobody is signed in.
 */
export function createNextAuth(config: NextAuthConfig) {
  const appKey = config.appKey ?? process.env.AUTHENTIK_APP_KEY;
  return {
    async getSession(organizationId?: string | null): Promise<AuthSession | null> {
      const incoming = await headers();
      const forwarded = new Headers();
      for (const name of ["cookie", "authorization"]) {
        const value = incoming.get(name);
        if (value) forwarded.set(name, value);
      }
      if (appKey) forwarded.set(APP_KEY_HEADER, appKey);
      const query = new URLSearchParams({ app: config.app, ...(organizationId ? { org: organizationId } : {}) });
      return fetchFromAuthServer<AuthSession>(`/api/nexus/session?${query}`, forwarded);
    },
  };
}

/**
 * `rewrites()` entries that keep sign-in same-origin (so cookies stay first-party):
 * `/api/auth/*` is proxied to the auth server.
 */
export function authentikAuthRewrites(authUrl = process.env.AUTHENTIK_URL ?? "") {
  const base = authUrl.replace(/\/$/, "");
  return [{ source: "/api/auth/:path*", destination: `${base}/api/auth/:path*` }];
}
