import { sql } from "drizzle-orm";

/**
 * Postgres GUCs used by domain RLS policies:
 * - app.user_id
 * - app.org_id
 * - app.role (optional)
 *
 * Example domain policy (lives in the service migration, not here):
 *
 *   ALTER TABLE accounting.invoice ENABLE ROW LEVEL SECURITY;
 *   CREATE POLICY invoice_tenant_isolation ON accounting.invoice
 *     USING (organization_id = current_setting('app.org_id', true))
 *     WITH CHECK (organization_id = current_setting('app.org_id', true));
 *
 * Connect domain DBs with a role that does NOT have BYPASSRLS.
 */

export type RlsContext = {
  userId: string;
  orgId?: string | null;
  role?: string | null;
};

type TxCapableDb = {
  transaction: <T>(
    fn: (tx: {
      execute: (query: ReturnType<typeof sql>) => Promise<unknown>;
    }) => Promise<T>,
  ) => Promise<T>;
};

export async function withRlsContext<T>(
  db: TxCapableDb,
  ctx: RlsContext,
  fn: (tx: {
    execute: (query: ReturnType<typeof sql>) => Promise<unknown>;
  }) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select set_config('app.user_id', ${ctx.userId}, true)`,
    );

    if (ctx.orgId) {
      await tx.execute(
        sql`select set_config('app.org_id', ${ctx.orgId}, true)`,
      );
    }

    if (ctx.role) {
      await tx.execute(sql`select set_config('app.role', ${ctx.role}, true)`);
    }

    return fn(tx);
  });
}
