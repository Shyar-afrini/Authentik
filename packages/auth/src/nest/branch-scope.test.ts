import { describe, expect, it } from "vitest";
import { branchInScope, resolveBranchScope } from "./branch-scope.js";
import type { AuthSession } from "./auth.port.js";

const B1 = "11111111-1111-4111-8111-111111111111";
const B2 = "22222222-2222-4222-8222-222222222222";
const auth = (over: Partial<AuthSession>): AuthSession => ({ session: {}, user: { id: "u" }, ...over });

describe("branch scope", () => {
  it("does not limit owners, admins or platform admins", () => {
    expect(resolveBranchScope(auth({ memberRole: "owner", branchIds: [B1] }))).toBeNull();
    expect(resolveBranchScope(auth({ memberRole: "admin", branchIds: [B1] }))).toBeNull();
    expect(resolveBranchScope(auth({ memberRole: "member", user: { id: "u", role: "admin" }, branchIds: [B1] }))).toBeNull();
  });

  it("limits a member who has branches and leaves the rest unlimited", () => {
    expect(resolveBranchScope(auth({ memberRole: "member", branchIds: [B1] }))).toEqual([B1]);
    expect(resolveBranchScope(auth({ memberRole: "member", branchIds: [] }))).toBeNull();
    expect(resolveBranchScope(auth({ memberRole: "member" }))).toBeNull();
  });

  it("keeps a limited member out of rows with no branch or another branch", () => {
    expect(branchInScope(B1, [B1])).toBe(true);
    expect(branchInScope(B2, [B1])).toBe(false);
    expect(branchInScope(null, [B1])).toBe(false);
    expect(branchInScope(null, null)).toBe(true);
  });
});
