import { Controller, Get, Inject, Injectable, Req, Res } from "@nestjs/common";
import { sql } from "drizzle-orm";
import type { Request, Response } from "express";
import type { Redis } from "ioredis";
import { REDIS } from "../better-auth/better-auth.module.js";
import { APP_CONFIG, type AppConfig } from "../config/env.js";
import { renderMetrics } from "../common/metrics.js";
import { AuthDB } from "../database/index.js";

/** Flipped on shutdown so /ready fails and load balancers stop sending traffic. */
@Injectable()
export class DrainState {
  draining = false;
}

@Controller()
export class HealthController {
  constructor(
    @Inject(REDIS) private readonly redis: Redis | null,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly drain: DrainState,
  ) {}

  private async checks(): Promise<{ db: "ok" | "down"; redis: "ok" | "down" | "off" }> {
    const [db, cache] = await Promise.all([
      AuthDB.execute(sql`select 1`).then(() => "ok" as const, () => "down" as const),
      this.redis ? this.redis.ping().then(() => "ok" as const, () => "down" as const) : Promise.resolve("off" as const),
    ]);
    // A lost optional cache degrades but does not fail readiness unless Redis is required.
    return { db, redis: cache === "down" && !this.config.requireRedis ? "off" : cache };
  }

  private async report(res: Response, checkDraining: boolean) {
    const checks = await this.checks();
    const ok = checks.db === "ok" && checks.redis !== "down" && (!checkDraining || !this.drain.draining);
    res.status(ok ? 200 : 503).json({ status: ok ? "ok" : "unavailable", draining: this.drain.draining, ...checks });
  }

  @Get(["health", "healthz"])
  health(@Res() res: Response) {
    return this.report(res, false);
  }

  @Get("ready")
  ready(@Res() res: Response) {
    return this.report(res, true);
  }

  @Get("metrics")
  metrics(@Req() req: Request, @Res() res: Response) {
    const token = this.config.metricsToken;
    const allowed = token
      ? req.headers.authorization === `Bearer ${token}`
      : ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.socket.remoteAddress ?? "");
    if (!allowed) return res.status(403).json({ code: "forbidden", message: "Metrics are not exposed to this caller" });
    res.type("text/plain; version=0.0.4").send(renderMetrics({ auth_db_pool_max: this.config.dbPoolMax }));
  }
}
