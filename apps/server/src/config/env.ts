import "dotenv/config";

const list = (value: string | undefined, fallback = ""): string[] =>
  (value ?? fallback).split(",").map((x) => x.trim()).filter(Boolean);

export type AppConfig = ReturnType<typeof loadConfig>;

/** Validates the environment once at boot; the process exits with every problem listed. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const problems: string[] = [];
  if (!env.DATABASE_URL?.trim()) problems.push("DATABASE_URL is required (the auth server's own database)");
  if ((env.BETTER_AUTH_SECRET?.trim().length ?? 0) < 32) problems.push("BETTER_AUTH_SECRET must be at least 32 characters");
  if (problems.length) {
    console.error(`[authentik] invalid environment:\n - ${problems.join("\n - ")}`);
    process.exit(1);
  }
  const publicUrl = (env.BETTER_AUTH_URL ?? "http://localhost:3005").replace(/\/$/, "");
  const dashboardUrl = (env.AUTH_DASHBOARD_URL ?? "http://localhost:3006").replace(/\/$/, "");
  return {
    port: Number(env.AUTH_PORT ?? 3005),
    host: env.AUTH_HOST ?? "0.0.0.0",
    publicUrl,
    redisUrl: env.REDIS_URL?.trim() || undefined,
    requireRedis: env.AUTH_REQUIRE_REDIS === "1",
    trustedOrigins: list(env.AUTH_TRUSTED_ORIGINS ?? env.WEB_ORIGIN, dashboardUrl),
    trustedProxies: list(env.AUTH_TRUSTED_PROXIES),
    metricsToken: env.AUTH_METRICS_TOKEN?.trim() || undefined,
    dbPoolMax: Number(env.AUTH_DB_POOL_MAX ?? 3),
    logRequests: env.AUTH_LOG_REQUESTS !== "0",
    purgeIntervalMs: Number(env.AUTH_PURGE_INTERVAL_MS ?? 3_600_000),
    singleTenant: ["1", "true", "yes"].includes(env.AUTHENTIK_SINGLE_TENANT?.trim().toLowerCase() ?? ""),
    cookieDomain: env.AUTH_COOKIE_DOMAIN?.trim() || undefined,
    breachCheck: env.AUTH_BREACH_CHECK === "1",
    issuerName: env.AUTH_ISSUER_NAME?.trim() || undefined,
    sessionCookieCacheSeconds: Number(env.AUTH_SESSION_COOKIE_CACHE_SECONDS ?? 60),
    oidc:
      env.AUTH_OIDC === "0"
        ? undefined
        : {
            // The sign-in and consent pages belong to the dashboard.
            loginPage: env.AUTH_LOGIN_URL ?? `${dashboardUrl}/login`,
            consentPage: env.AUTH_CONSENT_URL ?? `${dashboardUrl}/consent`,
            issuer: env.AUTH_ISSUER?.trim() || undefined,
            resources: list(env.AUTH_RESOURCES),
            scopes: list(env.AUTH_EXTRA_SCOPES),
          },
  };
}

/** Provider token for the validated config. */
export const APP_CONFIG = Symbol("APP_CONFIG");
