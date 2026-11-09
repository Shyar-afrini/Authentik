import { describe, expect, it } from "vitest";
import { can, createAbilityFor } from "./ability.js";
import type { AuthSession } from "./auth.port.js";

function session(partial: Partial<AuthSession> & { memberRole?: string }): AuthSession {
  return {
    user: { id: "u1", role: null, ...(partial.user ?? {}) },
    session: { activeOrganizationId: "org1", ...(partial.session ?? {}) },
    memberRole: partial.memberRole ?? "member",
    permissions: partial.permissions,
  };
}

describe("createAbilityFor", () => {
  it("lets expense_clerk create Expense but not SalesInvoice", () => {
    const ability = createAbilityFor(session({ memberRole: "expense_clerk" }));
    expect(ability.can("create", "Expense")).toBe(true);
    expect(ability.can("create", "SalesInvoice")).toBe(false);
  });

  it("lets accountant manage Accounting features", () => {
    const ability = createAbilityFor(session({ memberRole: "accountant" }));
    expect(ability.can("manage", "Accounting")).toBe(true);
    expect(ability.can("manage", "Expense")).toBe(true);
    expect(ability.can("manage", "Journal")).toBe(true);
    expect(ability.can("manage", "Lead")).toBe(false);
  });

  it("applies deny overrides from session.permissions", () => {
    const ability = createAbilityFor(
      session({
        memberRole: "accountant",
        permissions: [{ action: "manage", subject: "Expense", effect: "deny" }],
      }),
    );
    expect(ability.can("manage", "Expense")).toBe(false);
    expect(ability.can("manage", "Journal")).toBe(true);
  });
});

describe("can", () => {
  it("inherits domain grants for feature subjects", () => {
    expect(
      can(session({ memberRole: "warehouse" }), "read", "Warehouse"),
    ).toBe(true);
    expect(
      can(session({ memberRole: "warehouse" }), "manage", "Catalog"),
    ).toBe(true);
  });

  it("resolves role aliases to the same template (pos → cashier)", () => {
    expect(can(session({ memberRole: "pos" }), "create", "PosSale")).toBe(true);
    expect(can(session({ memberRole: "cashier" }), "create", "PosSale")).toBe(
      true,
    );
    expect(can(session({ memberRole: "inventory" }), "manage", "Warehouse")).toBe(
      true,
    );
  });

  it("denies create Expense when overrides leave read-only", () => {
    const s = session({
      memberRole: "expense_clerk",
      permissions: [
        { action: "create", subject: "Expense", effect: "deny" },
        { action: "update", subject: "Expense", effect: "deny" },
      ],
    });
    expect(can(s, "read", "Expense")).toBe(true);
    expect(can(s, "create", "Expense")).toBe(false);
  });
});
