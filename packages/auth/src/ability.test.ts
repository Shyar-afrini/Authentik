import { describe, expect, it } from "vitest";
import { can, createAbilityFor } from "./ability.js";

function principal(
  memberRole: string,
  permissions?: Array<{ action: string; subject: string; effect?: "allow" | "deny" }>,
) {
  return {
    user: { id: "u1", role: "user" },
    memberRole,
    permissions,
  };
}

describe("createAbilityFor member least-privilege", () => {
  it("member can read domains but cannot post journals or create IMS receipts", () => {
    const session = principal("member");
    expect(can(session, "read", "Accounting")).toBe(true);
    expect(can(session, "read", "Journal")).toBe(true);
    expect(can(session, "create", "Journal")).toBe(false);
    expect(can(session, "manage", "Journal")).toBe(false);
    expect(can(session, "create", "StockDocument")).toBe(false);
    expect(can(session, "manage", "SalesInvoice")).toBe(false);
  });

  it("sales cannot manage journals or create IMS stock documents", () => {
    const session = principal("sales");
    expect(can(session, "manage", "SalesOrder")).toBe(true);
    expect(can(session, "create", "Journal")).toBe(false);
    expect(can(session, "manage", "Journal")).toBe(false);
    expect(can(session, "create", "StockDocument")).toBe(false);
    expect(can(session, "manage", "Inventory")).toBe(false);
  });

  it("cashier cannot post sales invoices; accountant cannot open POS session by default", () => {
    const cashier = principal("cashier");
    expect(can(cashier, "create", "PosSale")).toBe(true);
    expect(can(cashier, "manage", "SalesInvoice")).toBe(false);
    expect(can(cashier, "create", "SalesInvoice")).toBe(false);

    const accountant = principal("accountant");
    expect(can(accountant, "manage", "Accounting")).toBe(true);
    expect(can(accountant, "create", "PosSession")).toBe(false);
    expect(can(accountant, "manage", "Pos")).toBe(false);
  });

  it("owner and admin retain full manage", () => {
    for (const role of ["owner", "admin"] as const) {
      const session = principal(role);
      expect(can(session, "manage", "Journal")).toBe(true);
      expect(can(session, "manage", "PosSale")).toBe(true);
      expect(can(session, "manage", "StockDocument")).toBe(true);
    }
  });

  it("member matrix allow can grant journal create", () => {
    const session = principal("member", [
      { action: "create", subject: "Journal", effect: "allow" },
    ]);
    expect(can(session, "create", "Journal")).toBe(true);
    expect(can(session, "manage", "Journal")).toBe(false);
  });

  it("PosSale implies Store/Terminal/PosSession companions", () => {
    const session = principal("member", [
      { action: "manage", subject: "PosSale", effect: "allow" },
    ]);
    expect(can(session, "read", "Store")).toBe(true);
    expect(can(session, "manage", "PosSession")).toBe(true);
    expect(can(session, "read", "PosDashboard")).toBe(true);
  });
});

describe("createAbilityFor builds", () => {
  it("returns empty ability without user id", () => {
    const ability = createAbilityFor({ user: null });
    expect(ability.can("read", "Accounting")).toBe(false);
  });
});
