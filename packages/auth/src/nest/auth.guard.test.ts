import { ForbiddenException } from "@nestjs/common";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthGuard, isOpenApiPath } from "./auth.guard";
import { resolveNexusAuth } from "./auth.port";

function guardFor(session: Record<string, unknown>) {
  const reflector = { getAllAndOverride: () => false };
  const auth = {
    mode: "port" as const,
    port: { getSession: async () => session as never },
  };
  return new AuthGuard(reflector as never, auth);
}

function ctx(headers: Record<string, string> = {}) {
  const request = { path: "/api/v1/accounting/accounts", headers } as never;
  return {
    request,
    context: {
      getHandler: () => null,
      getClass: () => null,
      switchToHttp: () => ({ getRequest: () => request }),
    } as never,
  };
}

afterEach(() => {
  delete process.env.AUTHENTIK_SINGLE_TENANT;
  delete process.env.AUTHENTIK_ALLOW_HEADER_AUTH;
  vi.unstubAllEnvs();
});

describe("AuthGuard with the Authentik server", () => {
  const resolved = {
    user: { id: "u1" },
    session: { activeOrganizationId: "org-a" },
    memberId: "m9",
    memberRole: "admin",
    branchIds: ["b1"],
    resolvedOrganizationId: "org-b",
    entitled: true,
  };

  it("uses the membership the server resolved for the requested organization", async () => {
    const { context, request } = ctx({ "x-organization-id": "org-b" });
    await expect(guardFor(resolved).canActivate(context)).resolves.toBe(true);
    expect((request as { auth: { memberRole: string; branchIds: string[] } }).auth).toMatchObject({
      memberRole: "admin",
      branchIds: ["b1"],
    });
  });

  it("allows the session organization", async () => {
    const { context } = ctx();
    const own = { ...resolved, resolvedOrganizationId: "org-a" };
    await expect(guardFor(own).canActivate(context)).resolves.toBe(true);
  });

  it("rejects an organization the server did not resolve a membership for", async () => {
    const { context } = ctx({ "x-organization-id": "org-c" });
    await expect(guardFor(resolved).canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects an organization that is not entitled to the application", async () => {
    const { context } = ctx({ "x-organization-id": "org-b" });
    await expect(guardFor({ ...resolved, entitled: false }).canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("requires a membership even on a single-tenant host", async () => {
    vi.stubEnv("AUTHENTIK_SINGLE_TENANT", "true");
    const { context } = ctx({ "x-organization-id": "org-b" });
    const noMember = { ...resolved, memberId: null, memberRole: null, branchIds: undefined };
    await expect(guardFor(noMember).canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe("isOpenApiPath", () => {
  it("matches exact docs segments only", () => {
    expect(isOpenApiPath("/docs")).toBe(true);
    expect(isOpenApiPath("/docs-json")).toBe(true);
    expect(isOpenApiPath("/api/v1/docs/")).toBe(true);
    expect(isOpenApiPath("/api/v1/documents")).toBe(false);
    expect(isOpenApiPath("/api/v1/accounting/docs-archive")).toBe(false);
  });
});

describe("resolveNexusAuth", () => {
  it("allows header mode outside production", () => {
    expect(resolveNexusAuth().mode).toBe("header");
  });

  it("refuses the header default in production unless explicitly allowed", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(() => resolveNexusAuth()).toThrow(/disabled in production/);
    expect(() => resolveNexusAuth({ mode: "none" })).not.toThrow();
    process.env.AUTHENTIK_ALLOW_HEADER_AUTH = "1";
    expect(resolveNexusAuth().mode).toBe("header");
  });
});
