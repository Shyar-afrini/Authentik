import { describe, expect, it } from "vitest";
import { generateAppKey, hashAppKey, parseAppKey, resolveCaller } from "./app-keys.js";
import { RegistryError } from "./registry.js";

/** In-memory stand-in for the application_key table: app → active secret hash. */
function store(active: Record<string, string>) {
  return {
    appForKeyHash: async (hash: string) => Object.entries(active).find(([, h]) => h === hash)?.[0] ?? null,
    hasActiveKey: async (app: string) => app in active,
  };
}

async function code(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return "ok";
  } catch (e) {
    return e instanceof RegistryError ? `${e.status}:${e.code}` : "other";
  }
}

describe("application keys", () => {
  it("generates a key that names its app and stores only a hash", () => {
    const { secret, hash, hint } = generateAppKey("billing");
    expect(parseAppKey(secret)).toEqual({ app: "billing" });
    expect(hash).toBe(hashAppKey(secret));
    expect(hash).not.toContain(secret.slice(10));
    expect(hint).toBe(secret.slice(-4));
    expect(generateAppKey("billing").secret).not.toBe(secret);
  });

  it("rejects text that is not a key", () => {
    for (const bad of ["", "authentik", "nak_billing_short", "nak_Billing_" + "a".repeat(64), `nak_x_${"g".repeat(64)}`]) {
      expect(parseAppKey(bad)).toBeNull();
    }
  });
});

describe("resolveCaller", () => {
  const billing = generateAppKey("billing");
  const authentik = generateAppKey("authentik");
  const lookups = store({ billing: billing.hash, authentik: authentik.hash });

  it("acts as the app its key belongs to", async () => {
    expect(await resolveCaller({ key: billing.secret }, lookups)).toBe("billing");
    expect(await resolveCaller({ key: billing.secret, claimed: "billing" }, lookups)).toBe("billing");
  });

  it("refuses a key used to claim another application", async () => {
    expect(await code(resolveCaller({ key: billing.secret, claimed: "authentik" }, lookups))).toBe("403:app_mismatch");
  });

  it("refuses unknown, revoked and forged keys", async () => {
    const other = generateAppKey("billing");
    expect(await code(resolveCaller({ key: other.secret }, lookups))).toBe("401:invalid_app_key");
    expect(await code(resolveCaller({ key: "nak_billing_" + "0".repeat(64) }, lookups))).toBe("401:invalid_app_key");
    expect(await code(resolveCaller({ key: "garbage" }, lookups))).toBe("401:invalid_app_key");
    // A key whose text names one app but whose hash belongs to another is not accepted.
    const swapped = store({ authentik: hashAppKey(billing.secret) });
    expect(await code(resolveCaller({ key: billing.secret }, swapped))).toBe("401:invalid_app_key");
  });

  it("requires the key once an app has one, including for the default app", async () => {
    expect(await code(resolveCaller({ claimed: "billing" }, lookups))).toBe("401:app_key_required");
    expect(await code(resolveCaller({}, lookups))).toBe("401:app_key_required");
  });

  it("lets apps without a key keep working unauthenticated", async () => {
    expect(await resolveCaller({ claimed: "legacy" }, store({}))).toBe("legacy");
    expect(await resolveCaller({}, store({ billing: billing.hash }))).toBe("authentik");
  });
});
