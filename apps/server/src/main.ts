import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { sql } from "drizzle-orm";
import { toNodeHandler } from "better-auth/node";
import express from "express";
import helmet from "helmet";
import { AppModule } from "./app.module.js";
import { AUTH } from "./better-auth/better-auth.module.js";
import type { NexusAuth } from "./better-auth/create-auth.js";
import { requestContextMiddleware } from "./common/request-context.middleware.js";
import { APP_CONFIG, type AppConfig } from "./config/env.js";
import { allOrgOrigins } from "./organizations/settings.js";
import { AuthDB } from "./database/index.js";
import { DrainState } from "./health/health.controller.js";

async function bootstrap() {
  // bodyParser is off: Better Auth reads its own raw body, so JSON parsing is mounted after its handler.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  const config = app.get<AppConfig>(APP_CONFIG);
  const auth = app.get<NexusAuth>(AUTH);
  const drain = app.get(DrainState);

  // This process is the auth server: sessions are always resolved in-process, never via AUTHENTIK_URL.
  delete process.env.AUTHENTIK_URL;
  if (config.trustedProxies.length) app.set("trust proxy", config.trustedProxies);
  app.disable("x-powered-by");

  app.use(requestContextMiddleware(config.logRequests));
  app.use(helmet());
  app.use(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const origin = req.headers.origin;
    const allowed = !!origin && (config.trustedOrigins.includes(origin) || (await allOrgOrigins().catch(() => [] as string[])).includes(origin));
    if (allowed) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,Cookie,x-organization-id,x-authentik-app-key");
    }
    if (req.method === "OPTIONS") return void res.status(allowed ? 204 : 403).end();
    next();
  });

  // Without trusted proxies the client's X-Forwarded-For is attacker-controlled, so it is replaced with the socket address.
  const betterAuth = toNodeHandler(auth);
  app.use("/api/auth", (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!config.trustedProxies.length && req.socket.remoteAddress) req.headers["x-forwarded-for"] = req.socket.remoteAddress;
    betterAuth(req, res).catch(next);
  });
  app.use(express.json({ limit: "64kb" }));
  app.enableShutdownHooks();

  // Expired sessions/verifications only add index bloat; purge them on a timer.
  if (config.purgeIntervalMs > 0) {
    const purge = async () => {
      try {
        const sessions = await AuthDB.execute(sql`delete from auth.session where expires_at < now()`);
        const verifications = await AuthDB.execute(sql`delete from auth.verification where expires_at < now()`);
        console.log(`[authentik] purged ${sessions.count} sessions, ${verifications.count} verifications`);
      } catch (error) {
        console.error("[authentik] purge failed", error);
      }
    };
    setTimeout(purge, 10_000).unref();
    setInterval(purge, config.purgeIntervalMs).unref();
  }

  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.once(signal, () => {
      console.log(`[authentik] ${signal}, shutting down`);
      drain.draining = true;
      setTimeout(() => process.exit(1), 10_000).unref();
      void app.close().then(() => process.exit(0));
    });
  }

  await app.listen(config.port, config.host);
  console.log(`[authentik] listening on http://${config.host}:${config.port}`);
}

void bootstrap();
