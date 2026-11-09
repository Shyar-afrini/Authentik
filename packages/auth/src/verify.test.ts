import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTokenVerifier, hasScope, tokenBelongsToApp } from "./verify.js";

let server: Server;
let authUrl: string;
let sign: (opts?: { iss?: string; aud?: string; exp?: string; key?: CryptoKey }) => Promise<string>;

beforeAll(async () => {
  const { publicKey, privateKey } = await generateKeyPair("EdDSA");
  const jwk = { ...(await exportJWK(publicKey)), kid: "k1", alg: "EdDSA" };
  server = createServer((req, res) => {
    if (req.url === "/api/auth/jwks") {
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ keys: [jwk] }));
    } else res.writeHead(404).end();
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  authUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  sign = (o = {}) =>
    new SignJWT({ scope: "nexus:read nexus:write", role: "admin" })
      .setProtectedHeader({ alg: "EdDSA", kid: "k1" })
      .setSubject("user-1")
      .setIssuer(o.iss ?? `${authUrl}/api/auth`)
      .setAudience(o.aud ?? "api-a")
      .setIssuedAt()
      .setExpirationTime(o.exp ?? "5m")
      .sign(o.key ?? privateKey);
});
afterAll(() => new Promise((r) => server.close(r)));

describe("createTokenVerifier", () => {
  const verifier = () => createTokenVerifier({ authUrl, audience: "api-a" });

  it("accepts a valid token and exposes claims", async () => {
    const claims = await verifier()(await sign());
    expect(claims.sub).toBe("user-1");
    expect(hasScope(claims, "nexus:read")).toBe(true);
    expect(hasScope(claims, "nexus:delete")).toBe(false);
  });

  it("rejects a token for another audience", async () => {
    await expect(verifier()(await sign({ aud: "api-b" }))).rejects.toThrow();
  });

  it("rejects a token from another issuer", async () => {
    await expect(verifier()(await sign({ iss: "https://evil.example" }))).rejects.toThrow();
  });

  it("rejects an expired token", async () => {
    await expect(verifier()(await sign({ exp: "-1m" }))).rejects.toThrow();
  });

  it("rejects a token signed by an unknown key", async () => {
    const other = await generateKeyPair("EdDSA");
    await expect(verifier()(await sign({ key: other.privateKey }))).rejects.toThrow();
  });

  it("rejects a tampered token", async () => {
    const token = await sign();
    await expect(verifier()(token.slice(0, -4) + "AAAA")).rejects.toThrow();
  });
});

describe("tokenBelongsToApp", () => {
  it("accepts only tokens minted for the application", () => {
    expect(tokenBelongsToApp({ app: "billing" }, "billing")).toBe(true);
    expect(tokenBelongsToApp({ app: "nexus" }, "billing")).toBe(false);
    expect(tokenBelongsToApp({}, "billing")).toBe(false);
  });
});
