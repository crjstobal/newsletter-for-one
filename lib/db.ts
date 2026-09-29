import { Pool, type QueryResultRow } from "pg";
import { getKey } from "./secrets";

/**
 * One pool per process. DATABASE_URL comes from the environment (hosting platform, Nebius Job)
 * or, locally, falls back to the local Postgres database.
 */
const g = globalThis as unknown as { __nfoPool?: Promise<Pool> };

async function createPool() {
  let url = process.env.DATABASE_URL;
  if (!url && process.env.NFO_DB_FROM_SSM) url = await getKey("newsletter-for-one.env", "DATABASE_URL");
  return new Pool({ connectionString: url ?? "postgres://localhost:5432/newsletter_for_one", max: 5 });
}

export function pool() {
  g.__nfoPool ??= createPool();
  return g.__nfoPool;
}

export async function q<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []) {
  return (await pool()).query<T>(text, params);
}
