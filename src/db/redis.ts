import { Redis } from "@upstash/redis";

const isLocalDatabase = /@(localhost|127\.0\.0\.1)[:/]/.test(
  process.env.DATABASE_URL ?? "",
);

/**
 * In-memory stand-in used with a local database so local data never gets
 * cached into (or read from) the production Upstash instance.
 */
function createLocalRedis() {
  const store = new Map<string, { value: unknown; expiresAt: number | null }>();

  return {
    async get<T>(key: string): Promise<T | null> {
      const entry = store.get(key);
      if (!entry) return null;
      if (entry.expiresAt !== null && entry.expiresAt < Date.now()) {
        store.delete(key);
        return null;
      }
      return entry.value as T;
    },
    async set(key: string, value: unknown, options?: { ex?: number }) {
      store.set(key, {
        value: JSON.parse(JSON.stringify(value)),
        expiresAt: options?.ex ? Date.now() + options.ex * 1000 : null,
      });
      return "OK" as const;
    },
    async del(...keys: string[]) {
      return keys.filter((key) => store.delete(key)).length;
    },
  };
}

export const redis = isLocalDatabase
  ? (createLocalRedis() as unknown as Redis)
  : Redis.fromEnv();
