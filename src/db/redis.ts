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
    async set(key: string, value: unknown, options?: { ex?: number; nx?: boolean }) {
      const existing = store.get(key);
      if (options?.nx && existing && (existing.expiresAt === null || existing.expiresAt >= Date.now())) {
        return null;
      }
      store.set(key, {
        value: JSON.parse(JSON.stringify(value)),
        expiresAt: options?.ex ? Date.now() + options.ex * 1000 : null,
      });
      return "OK" as const;
    },
    async del(...keys: string[]) {
      return keys.filter((key) => store.delete(key)).length;
    },
    async incr(key: string) {
      const entry = store.get(key);
      const current = entry && (entry.expiresAt === null || entry.expiresAt >= Date.now()) ? entry : undefined;
      const value = Number(current?.value ?? 0) + 1;
      store.set(key, { value, expiresAt: current?.expiresAt ?? null });
      return value;
    },
    async hincrby(key: string, field: string, by: number) {
      const hash = (await this.get<Record<string, number>>(key)) ?? {};
      hash[field] = (hash[field] ?? 0) + by;
      const expiresAt = store.get(key)?.expiresAt ?? null;
      store.set(key, { value: hash, expiresAt });
      return hash[field];
    },
    async hget<T>(key: string, field: string): Promise<T | null> {
      const hash = await this.get<Record<string, T>>(key);
      return hash?.[field] ?? null;
    },
    async hgetall<T extends Record<string, unknown>>(key: string): Promise<T | null> {
      return this.get<T>(key);
    },
    async expire(key: string, seconds: number) {
      const entry = store.get(key);
      if (!entry) return 0;
      entry.expiresAt = Date.now() + seconds * 1000;
      return 1;
    },
  };
}

export const redis = isLocalDatabase
  ? (createLocalRedis() as unknown as Redis)
  : Redis.fromEnv();
