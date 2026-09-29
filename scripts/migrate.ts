/** Applies db/migrations/*.sql in order, once each. */
import { promises as fs } from "fs";
import path from "path";
import { pool } from "../lib/db";

async function main() {
  const db = await pool();
  await db.query("create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())");
  const done = new Set((await db.query<{ name: string }>("select name from schema_migrations")).rows.map((r) => r.name));
  const dir = path.join(process.cwd(), "db", "migrations");
  for (const file of (await fs.readdir(dir)).filter((f) => f.endsWith(".sql")).sort()) {
    if (done.has(file)) continue;
    const client = await db.connect();
    try {
      await client.query("begin");
      await client.query(await fs.readFile(path.join(dir, file), "utf8"));
      await client.query("insert into schema_migrations (name) values ($1)", [file]);
      await client.query("commit");
      console.log(`applied ${file}`);
    } catch (err) {
      await client.query("rollback");
      throw err;
    } finally {
      client.release();
    }
  }
  await db.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
