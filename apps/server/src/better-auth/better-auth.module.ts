import { Global, Inject, Injectable, Module, type OnApplicationShutdown } from "@nestjs/common";
import type { Redis } from "ioredis";
import { shareKeyChanges } from "../applications/app-keys.js";
import { APP_CONFIG, type AppConfig } from "../config/env.js";
import { createAuth, type NexusAuth } from "./create-auth.js";
import { connectRedis, createRedisStorage } from "./redis-storage.js";

export const AUTH = Symbol("BETTER_AUTH");
export const REDIS = Symbol("REDIS");

/** Redis speeds up sessions and backs rate limits; without it the server falls back to Postgres. */
async function connectOptionalRedis(config: AppConfig): Promise<Redis | null> {
  if (!config.redisUrl) return null;
  const client = connectRedis(config.redisUrl);
  client.on("error", () => {});
  try {
    await client.connect();
    await client.ping();
    return client;
  } catch (error) {
    client.disconnect();
    if (config.requireRedis) {
      console.error("[authentik] Redis is required but unreachable", error);
      process.exit(1);
    }
    console.warn("[authentik] Redis unreachable, sessions and rate limits use Postgres/memory");
    return null;
  }
}

@Injectable()
class RedisShutdown implements OnApplicationShutdown {
  constructor(@Inject(REDIS) private readonly redis: Redis | null) {}
  onApplicationShutdown() {
    this.redis?.disconnect();
  }
}

@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      inject: [APP_CONFIG],
      useFactory: async (config: AppConfig) => {
        const redis = await connectOptionalRedis(config);
        if (redis) await shareKeyChanges(redis).catch((e) => console.warn("[authentik] key change sharing is off", e));
        return redis;
      },
    },
    {
      provide: AUTH,
      inject: [APP_CONFIG, REDIS],
      useFactory: (config: AppConfig, redis: Redis | null): NexusAuth =>
        createAuth({
          nextCookies: false,
          secondaryStorage: redis ? createRedisStorage(redis) : undefined,
          cookieDomain: config.cookieDomain,
          trustedProxies: config.trustedProxies,
          breachCheck: config.breachCheck,
          issuerName: config.issuerName,
          oidc: config.oidc,
          sessionCookieCacheSeconds: config.sessionCookieCacheSeconds,
        }),
    },
    RedisShutdown,
  ],
  exports: [AUTH, REDIS],
})
export class BetterAuthModule {}
