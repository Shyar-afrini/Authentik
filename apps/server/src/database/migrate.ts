import "dotenv/config";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { AuthDB } from "./index.js";

/**
 * Applies drizzle/*.sql from the installed package (the container runs this before `start`).
 * It keeps drizzle-kit's bookkeeping table (auth.__drizzle_migrations), so databases migrated
 * with `drizzle-kit migrate` continue from where they are. drizzle's own migrator cannot be used:
 * it creates the `auth` schema first and then migration 0000 fails on `CREATE SCHEMA "auth"`.
 */
const migrations = readMigrationFiles({
  migrationsFolder: fileURLToPath(new URL("../../drizzle", import.meta.url)),
});

await AuthDB.transaction(async (tx) => {
  // Serialise concurrent replicas starting at once.
  await tx.execute(sql`select pg_advisory_xact_lock(7355608)`);
  await tx.execute(sql`create schema if not exists auth`);
  await tx.execute(sql`create table if not exists auth.__drizzle_migrations (
    id serial primary key, hash text not null, created_at bigint)`);
  const last = await tx.execute<{ created_at: string }>(
    sql`select created_at from auth.__drizzle_migrations order by created_at desc limit 1`,
  );
  const lastApplied = last[0] ? Number(last[0].created_at) : -1;
  let applied = 0;
  for (const m of migrations) {
    if (m.folderMillis <= lastApplied) continue;
    for (const statement of m.sql) {
      if (/^\s*CREATE SCHEMA "auth";?\s*$/i.test(statement)) continue;
      await tx.execute(sql.raw(statement));
    }
    await tx.execute(
      sql`insert into auth.__drizzle_migrations (hash, created_at) values (${m.hash}, ${m.folderMillis})`,
    );
    applied++;
  }
  console.log(`[authentik] migrations applied: ${applied} new, ${migrations.length - applied} already present`);
});
process.exit(0);
