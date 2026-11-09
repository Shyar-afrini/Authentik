/** What the auth server's `/api/auth/get-session` returns. */
export type Session = {
  session: { id: string; userId: string; expiresAt: string; activeOrganizationId?: string | null } & Record<string, unknown>;
  user: { id: string; email: string; name: string; role?: string | null; image?: string | null } & Record<string, unknown>;
};
export type User = Session["user"];
type SessionResult = Session | null;

/** Base URL of the standalone auth server (`apps/server`). */
export function remoteAuthUrl(): string | null {
  const url = process.env.AUTHENTIK_URL?.trim().replace(/\/$/, "");
  return url || null;
}

/** Forward only the credentials the auth server needs to identify the caller. */
export async function fetchFromAuthServer<T>(
  path: string,
  headers: Headers,
): Promise<T | null> {
  const base = remoteAuthUrl();
  if (!base) throw new Error("AUTHENTIK_URL is not set");
  const forwarded = new Headers();
  for (const name of ["cookie", "authorization", "x-authentik-app-key"]) {
    const value = headers.get(name);
    if (value) forwarded.set(name, value);
  }
  const res = await fetch(`${base}${path}`, {
    headers: forwarded,
    signal: AbortSignal.timeout(5_000),
    cache: "no-store",
  });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`auth server ${path} answered ${res.status}`);
  return (await res.json()) as T | null;
}

/** Resolves the session through the Authentik server (AUTHENTIK_URL). */
export async function getSession(headers: Headers): Promise<SessionResult> {
  return fetchFromAuthServer<Session>("/api/auth/get-session", headers);
}

/**
 * Nest / non-Next helpers: build a Headers object from raw cookie / authorization
 * strings without callers reaching into Better Auth APIs directly.
 */
export async function getSessionFromHeaders(init?: {
  cookie?: string | null;
  authorization?: string | null;
}) {
  const headers = new Headers();
  if (init?.cookie) {
    headers.set("cookie", init.cookie);
  }
  if (init?.authorization) {
    headers.set("authorization", init.authorization);
  }
  return getSession(headers);
}

export async function requireSession(headers: Headers) {
  const session = await getSession(headers);
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session;
}
