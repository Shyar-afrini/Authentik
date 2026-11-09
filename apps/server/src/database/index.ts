import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.js";

/**
 * Keep a tiny pool and reuse it across Next.js / Nest hot reloads.
 * Default postgres.js max=10 × many module graphs quickly exhausts PG.
 */
const globalForAuthDb = globalThis as unknown as {
  __nexusAuthSql?: ReturnType<typeof postgres>;
};

const client =
  globalForAuthDb.__nexusAuthSql ??
  postgres(process.env.DATABASE_URL!, {
    max: Number(process.env.AUTH_DB_POOL_MAX ?? 3),
    idle_timeout: 20,
    max_lifetime: 60 * 30,
    connection: {
      search_path: "auth",
      TimeZone: process.env.AUTH_DB_TIMEZONE ?? "Asia/Baghdad",
    },
  });

if (process.env.NODE_ENV !== "production") {
  globalForAuthDb.__nexusAuthSql = client;
}

export const AuthDB = drizzle(client, { schema });
