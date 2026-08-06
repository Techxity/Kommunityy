// Neon Postgres client (server-only). Replaces the old Supabase DB access
// (supabaseAdmin) — auth also runs on Neon now, see src/lib/auth/*. This
// file must never be imported from client-side code: it holds a direct
// database connection string.
import { neon } from "@neondatabase/serverless";

function createSql() {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    throw new Error(
      "Missing DATABASE_URL environment variable. Add your Neon connection string to .env.",
    );
  }
  return neon(DATABASE_URL);
}

let _sql: ReturnType<typeof createSql> | undefined;

// Tagged-template SQL client for Neon. Import like:
//   import { sql } from "@/lib/db/client";
//   const rows = await sql`SELECT * FROM communities WHERE id = ${id}`;
export function getSql() {
  if (!_sql) _sql = createSql();
  return _sql;
}

// Proxy so `sql` can be imported and used directly as a tagged template,
// mirroring the ergonomics of the old `supabaseAdmin` export.
export const sql = new Proxy((() => {}) as ReturnType<typeof createSql>, {
  apply(_target, _thisArg, args: Parameters<ReturnType<typeof createSql>>) {
    return getSql()(...args);
  },
  get(_target, prop, receiver) {
    return Reflect.get(getSql(), prop, receiver);
  },
}) as ReturnType<typeof createSql>;
