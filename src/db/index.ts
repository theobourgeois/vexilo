import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { drizzle as drizzleNodePostgres } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL!;
const isLocalDatabase = /@(localhost|127\.0\.0\.1)[:/]/.test(databaseUrl);

// Neon's HTTP driver can't reach a plain Postgres, so local dev (docker compose)
// goes through node-postgres. The query API is the same either way.
export const db = isLocalDatabase
  ? (drizzleNodePostgres({
      client: new Pool({ connectionString: databaseUrl }),
    }) as unknown as ReturnType<typeof drizzle>)
  : drizzle({ client: neon(databaseUrl) });
