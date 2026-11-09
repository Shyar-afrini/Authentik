import { describe, expect, it } from "vitest";
import { assertAppKey, RegistryError, validateRegistryInput, type RegistryInput } from "./registry.js";

const valid = (): RegistryInput => ({
  name: "Billing",
  audience: "https://billing.example.com",
  subjects: [{ subject: "Invoice" }, { subject: "Report", actions: ["read"] }],
  roles: [{ key: "viewer", grants: [{ action: "read", subject: "Invoice" }] }],
});

function code(fn: () => void): string | undefined {
  try {
    fn();
  } catch (e) {
    return e instanceof RegistryError ? e.code : "other";
  }
  return undefined;
}

describe("validateRegistryInput", () => {
  it("accepts a well-formed registry", () => {
    expect(code(() => validateRegistryInput(valid()))).toBeUndefined();
  });

  it("rejects unknown actions, bad audiences and unnamed apps", () => {
    const badAction = valid();
    badAction.subjects[0].actions = ["explode"];
    expect(code(() => validateRegistryInput(badAction))).toBe("invalid_action");
    expect(code(() => validateRegistryInput({ ...valid(), audience: "not a uri" }))).toBe("invalid_audience");
    expect(code(() => validateRegistryInput({ ...valid(), name: "  " }))).toBe("invalid_name");
  });

  it("rejects role grants on subjects the app never declared", () => {
    const input = valid();
    input.roles[0].grants = [{ action: "read", subject: "Payroll" }];
    expect(code(() => validateRegistryInput(input))).toBe("unknown_subject");
  });

  it("allows the wildcard subject and rejects bad effects and duplicate roles", () => {
    const wildcard = valid();
    wildcard.roles = [{ key: "owner", grants: [{ action: "manage", subject: "all" }] }];
    expect(code(() => validateRegistryInput(wildcard))).toBeUndefined();

    const badEffect = valid();
    badEffect.roles[0].grants = [{ action: "read", subject: "Invoice", effect: "maybe" as never }];
    expect(code(() => validateRegistryInput(badEffect))).toBe("invalid_effect");

    const dup = valid();
    dup.roles.push({ key: "viewer", grants: [] });
    expect(code(() => validateRegistryInput(dup))).toBe("invalid_role");
  });

  it("rejects a subject declared twice", () => {
    const input = valid();
    input.subjects.push({ subject: "Invoice" });
    expect(code(() => validateRegistryInput(input))).toBe("duplicate_subject");
  });

  it("caps the number of subjects", () => {
    const input = valid();
    input.subjects = Array.from({ length: 501 }, (_, i) => ({ subject: `S${i}` }));
    expect(code(() => validateRegistryInput(input))).toBe("invalid_subjects");
  });
});

describe("assertAppKey", () => {
  it("accepts slugs and rejects anything else", () => {
    expect(code(() => assertAppKey("billing-2"))).toBeUndefined();
    for (const bad of ["", "A", "Billing", "x;drop", "../etc", "a".repeat(41)]) {
      expect(code(() => assertAppKey(bad))).toBe("invalid_app_key");
    }
  });
});
