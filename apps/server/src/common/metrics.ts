/** Minimal Prometheus text exposition: request counter and latency histogram, no dependency. */
const BUCKETS_S = [0.005, 0.025, 0.1, 0.25, 0.5, 1, 2.5, 5];

const requests = new Map<string, number>();
const latency = new Map<string, { buckets: number[]; sum: number; count: number }>();

const labelValue = (v: string) => v.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");

/** `group` is a small fixed set (never the raw URL) so label cardinality stays bounded. */
export function observeRequest(group: string, method: string, status: number, seconds: number): void {
  const key = `${labelValue(group)}\u0000${labelValue(method)}\u0000${Math.floor(status / 100)}xx`;
  requests.set(key, (requests.get(key) ?? 0) + 1);
  const h = latency.get(group) ?? { buckets: BUCKETS_S.map(() => 0), sum: 0, count: 0 };
  BUCKETS_S.forEach((le, i) => {
    if (seconds <= le) h.buckets[i]++;
  });
  h.sum += seconds;
  h.count++;
  latency.set(group, h);
}

export function renderMetrics(extra: Record<string, number> = {}): string {
  const out: string[] = ["# TYPE auth_http_requests_total counter"];
  for (const [key, n] of requests) {
    const [group, method, status] = key.split("\u0000");
    out.push(`auth_http_requests_total{group="${group}",method="${method}",status="${status}"} ${n}`);
  }
  out.push("# TYPE auth_http_request_duration_seconds histogram");
  for (const [group, h] of latency) {
    const g = labelValue(group);
    BUCKETS_S.forEach((le, i) =>
      out.push(`auth_http_request_duration_seconds_bucket{group="${g}",le="${le}"} ${h.buckets[i]}`),
    );
    out.push(`auth_http_request_duration_seconds_bucket{group="${g}",le="+Inf"} ${h.count}`);
    out.push(`auth_http_request_duration_seconds_sum{group="${g}"} ${h.sum}`);
    out.push(`auth_http_request_duration_seconds_count{group="${g}"} ${h.count}`);
  }
  for (const [name, value] of Object.entries(extra)) {
    out.push(`# TYPE ${name} gauge`, `${name} ${value}`);
  }
  return out.join("\n") + "\n";
}

export function resetMetrics(): void {
  requests.clear();
  latency.clear();
}

/** Coarse route group for metrics and logs. */
export function routeGroup(path: string): string {
  if (path.startsWith("/api/auth")) return "better-auth";
  if (path.startsWith("/api/v1/auth")) return "member-admin";
  if (path.startsWith("/api/nexus/session")) return "session";
  if (path.startsWith("/api/nexus")) return "registry";
  if (path === "/health" || path === "/healthz" || path === "/ready" || path === "/metrics") return "ops";
  return "other";
}
