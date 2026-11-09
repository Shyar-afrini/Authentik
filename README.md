# Authentik

A standalone, multi-tenant identity platform. It is hosted on its own, with its own Postgres database, and every system (Authentik or anything else) signs its users in through it.

```
apps/server      NestJS 11 + Better Auth. Owns the database (schema `auth`).
apps/dashboard   Next.js + Hel UI. Organizations, applications, keys, policy.
packages/auth               @authentik/auth: client library (Nest guard, Next adapter, CASL, offline token verify).
packages/auth-native        @authentik/auth-native: React Native / Expo client.
```

## Concepts

- **Organization**: a client. It has members, a set of applications it may use (entitlements), the client types it connects per application (`nestjs`, `nextjs`, `react-native`) and its own policy (2FA, session lifetime, minimum password length, allowed origins).
- **Application**: a system that trusts this server. One active key per application (`x-authentik-app-key`, stored as a SHA-256 hash). It publishes its own permission vocabulary (subjects, actions, role templates) with that key.
- **Session endpoint**: `GET /api/nexus/session?app=&org=` returns the user, their role in the organization, the grants for the calling application only, branch scope, and whether the organization is entitled to the application.

## Run it

```bash
cd apps/server
cp .env.example .env            # own DATABASE_URL, BETTER_AUTH_SECRET
pnpm build && pnpm migrate
SEED_ADMIN_EMAIL=you@example.com SEED_ADMIN_PASSWORD='...' pnpm seed   # first platform admin
pnpm start                       # http://localhost:3005

cd ../Dashboard
cp .env.example .env
pnpm dev                         # http://localhost:3006
```

## Onboarding a client

1. Dashboard → **Applications** → new application → **Issue key** (shown once).
2. Dashboard → **Organizations** → new organization, tick the applications and client types. Copy the **organization id**.
3. In the application set `AUTHENTIK_URL`, `AUTHENTIK_APP_KEY`, `AUTHENTIK_ORGANIZATION_ID` (the dashboard prints these).
4. Install the client for each client type:
   - NestJS: `@authentik/auth` (`AuthModule`, `AuthGuard`); publish the vocabulary at boot with `registerApplication`.
   - Next.js: `@authentik/auth/next` (`createNextAuth`, `authentikAuthRewrites`).
   - React Native: `@authentik/auth-native` (`createNexusNativeClient`, `authHeaders`). Never ship the application key in a mobile app; it belongs to your backend.

## Moving an existing ERP database over

The auth tables used to live in the ERP database. To split them:

```bash
pg_dump --schema=auth "$OLD_DATABASE_URL" | psql "$NEW_AUTH_DATABASE_URL"
```

Then point the auth server at `NEW_AUTH_DATABASE_URL` and the ERP Backend/Frontend at `AUTHENTIK_URL`. Drop the old `auth` schema from the ERP database only after verifying.

## Known gaps

- Webhooks replace the old `auth.user.created` event; until then nothing is emitted when a member is created.
- Organization session lifetime and 2FA are enforced at the session endpoint (for applications that call it), not by Better Auth's own cookie.
- The dashboard is English only.
