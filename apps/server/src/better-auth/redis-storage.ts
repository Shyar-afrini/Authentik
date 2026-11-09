import { Redis } from "ioredis";
import type { CreateAuthOptions } from "./create-auth.js";

type SecondaryStorage = NonNullable<CreateAuthOptions["secondaryStorage"]>;

/** Better Auth secondary storage on Redis (session reads, rate-limit counters). */
export function createRedisStorage(
  redis: Redis,
  prefix = "nexus:auth:",
): SecondaryStorage {
  const k = (key: string) => `${prefix}${key}`;
  return {
    get: (key) => redis.get(k(key)),
    getAndDelete: (key) => redis.getdel(k(key)),
    set: async (key, value, ttl) => {
      if (ttl) await redis.set(k(key), value, "EX", ttl);
      else await redis.set(k(key), value);
    },
    delete: async (key) => {
      await redis.del(k(key));
    },
    // Fixed window: TTL set only when the counter is created.
    increment: async (key, ttl) => {
      const count = await redis.incr(k(key));
      if (count === 1) await redis.expire(k(key), ttl);
      return count;
    },
  };
}

export function connectRedis(url: string): Redis {
  return new Redis(url, { maxRetriesPerRequest: 2, lazyConnect: true });
}
