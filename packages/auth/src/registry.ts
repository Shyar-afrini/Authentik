import { APP_KEY_HEADER } from "./app-key.js";
import { DOMAIN_SUBJECTS, FEATURES_BY_DOMAIN, ROLE_TEMPLATES } from "./permissions/index.js";

export type ApplicationRegistry = {
  name: string;
  /** Token audience (absolute URI); only for apps that verify access tokens. */
  audience?: string | null;
  subjects: { subject: string; actions?: string[]; description?: string }[];
  roles: { key: string; grants: { action: string; subject: string; effect?: "allow" | "deny" }[] }[];
};

/** The Authentik vocabulary, built from this package's catalog. */
export function nexusRegistry(): ApplicationRegistry {
  const subjects = [...new Set<string>([...DOMAIN_SUBJECTS, ...Object.values(FEATURES_BY_DOMAIN).flat()])].map((subject) => ({ subject }));
  const roles = Object.entries(ROLE_TEMPLATES).map(([key, grants]) => ({
    key,
    grants: grants.map((g) => ({ action: g.action, subject: String(g.subject), effect: g.effect })),
  }));
  return { name: "Authentik", subjects, roles };
}

/**
 * Publishes an application's permission vocabulary to the auth server, authenticated by the
 * application's own key. Call once at startup; it replaces the stored registry for `app`.
 */
export async function registerApplication(input: {
  authUrl: string;
  appKey: string;
  app: string;
  registry: ApplicationRegistry;
  timeoutMs?: number;
}): Promise<void> {
  const res = await fetch(`${input.authUrl.replace(/\/$/, "")}/api/nexus/apps/${encodeURIComponent(input.app)}/registry`, {
    method: "PUT",
    headers: { "content-type": "application/json", [APP_KEY_HEADER]: input.appKey },
    body: JSON.stringify(input.registry),
    signal: AbortSignal.timeout(input.timeoutMs ?? 10_000),
  });
  if (!res.ok) throw new Error(`registering "${input.app}" failed: auth server answered ${res.status}`);
}
