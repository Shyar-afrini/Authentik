import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import { inArray, sql, type AnyColumn, type SQL } from "drizzle-orm";
import type { AuthSession } from "./auth.port.js";
import type { AuthedRequest } from "./auth.guard.js";

/**
 * Branches the caller may see, or `null` for every branch.
 * Platform admins and organization owners and admins are never limited.
 */
export function resolveBranchScope(auth: AuthSession | undefined): string[] | null {
  if (!auth) return null;
  if (String(auth.user?.role ?? "").toLowerCase() === "admin") return null;
  const role = String(auth.memberRole ?? "").toLowerCase();
  if (role === "owner" || role === "admin") return null;
  return auth.branchIds?.length ? auth.branchIds : null;
}

/** Branch ids the caller is limited to, or `null` for every branch. Pass it to `branchScopeCondition`. */
export const BranchScope = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string[] | null =>
    resolveBranchScope(ctx.switchToHttp().getRequest<AuthedRequest>().auth),
);

/**
 * SQL condition keeping rows inside the caller's branches, or `undefined` when unlimited.
 * A limited caller never sees rows with no branch.
 */
export function branchScopeCondition(column: AnyColumn, scope: string[] | null): SQL | undefined {
  if (scope === null) return undefined;
  return scope.length ? inArray(column, scope) : sql`false`;
}

/** True when a single row's branch is inside the caller's scope. */
export function branchInScope(branchId: string | null | undefined, scope: string[] | null): boolean {
  return scope === null || (!!branchId && scope.includes(branchId));
}
