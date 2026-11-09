# @authentik/auth

Client library for the Authentik server (`.`). It has no database and no server: it talks to the auth server over HTTP.

| Import | Use |
| --- | --- |
| `@authentik/auth` | `getSession`, `createAbilityFor`, `registerApplication`, `nexusRegistry` |
| `@authentik/auth/nest` | `AuthModule`, `AuthGuard`, `RequireAbility`, `NexusAuthPort` |
| `@authentik/auth/next` | `createNextAuth({ app }).getSession(orgId)`, `authentikAuthRewrites()` |
| `@authentik/auth/client` | browser auth client, `useCan`, `AbilityRouteGate` |
| `@authentik/auth/verify` | offline JWT verification against the server's JWKS |
| `@authentik/auth/permissions` | the Authentik permission catalog |

## Environment (consuming application)

```
AUTHENTIK_URL=https://auth.example.com
AUTHENTIK_APP_KEY=nak_<app>_<64 hex>      # server-side only
AUTHENTIK_ORGANIZATION_ID=<uuid>         # single-tenant hosts
```

Everything else (database, secrets, Redis, policy) belongs to the auth server: see `./README.md`.
