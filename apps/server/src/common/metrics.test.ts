import { beforeEach, describe, expect, it } from "vitest";
import { observeRequest, renderMetrics, resetMetrics, routeGroup } from "./metrics.js";

describe("metrics", () => {
  beforeEach(resetMetrics);

  it("counts requests by group, method and status class", () => {
    observeRequest("session", "GET", 200, 0.01);
    observeRequest("session", "GET", 401, 0.02);
    observeRequest("session", "GET", 200, 0.3);
    const text = renderMetrics();
    expect(text).toContain('auth_http_requests_total{group="session",method="GET",status="2xx"} 2');
    expect(text).toContain('auth_http_requests_total{group="session",method="GET",status="4xx"} 1');
  });

  it("fills cumulative histogram buckets", () => {
    observeRequest("session", "GET", 200, 0.01);
    observeRequest("session", "GET", 200, 0.3);
    const text = renderMetrics();
    expect(text).toContain('le="0.025"} 1');
    expect(text).toContain('le="0.5"} 2');
    expect(text).toContain('le="+Inf"} 2');
  });

  it("groups routes without leaking raw paths", () => {
    expect(routeGroup("/api/v1/auth/members/abc")).toBe("member-admin");
    expect(routeGroup("/api/auth/sign-in/email")).toBe("better-auth");
    expect(routeGroup("/anything/else")).toBe("other");
  });
});
