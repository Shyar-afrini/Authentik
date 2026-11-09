import { describe, expect, it } from "vitest";
import { parseSettingsPatch } from "./settings.js";

describe("parseSettingsPatch", () => {
  it("accepts valid values and normalises origins", () => {
    expect(
      parseSettingsPatch({ requireTwoFactor: true, sessionMaxAgeSeconds: 3600, passwordMinLength: 12, allowedOrigins: ["https://a.example.com/x", "https://a.example.com"] }),
    ).toEqual({ requireTwoFactor: true, sessionMaxAgeSeconds: 3600, passwordMinLength: 12, allowedOrigins: ["https://a.example.com"] });
  });
  it("allows clearing the session lifetime", () => {
    expect(parseSettingsPatch({ sessionMaxAgeSeconds: null })).toEqual({ sessionMaxAgeSeconds: null });
  });
  it.each([
    [{ passwordMinLength: 4 }],
    [{ passwordMinLength: 1000 }],
    [{ sessionMaxAgeSeconds: 10 }],
    [{ requireTwoFactor: "yes" }],
    [{ allowedOrigins: ["javascript:alert(1)"] }],
    [{ allowedOrigins: "https://a.com" }],
  ])("rejects %j", (bad) => {
    expect(() => parseSettingsPatch(bad)).toThrow();
  });
});
