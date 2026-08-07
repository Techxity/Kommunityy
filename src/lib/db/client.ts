// Neon Postgres client (server-only). Replaces the old Supabase DB access
// (supabaseAdmin) — auth also runs on Neon now, see src/lib/auth/*. This
// file must never be imported from client-side code: it holds a direct
// database connection string.
import { neon } from "@neondatabase/serverless";

// The Neon serverless driver talks to the database over HTTP fetch. When the
// server's connection is flaky, a query rejects with something like
// `TypeError: fetch failed` (sometimes wrapped as "Error connecting to
// database: TypeError: fetch failed"). Left alone, that raw driver error
// propagates through the server function straight into the UI. Every screen
// in the app just does `catch (e) { setErr(e.message) }`, so the cleanest
// fix is one choke point here rather than editing every call site.
function isNetworkish(message: string): boolean {
  return /fetch failed|failed to fetch|networkerror|econnrefused|econnreset|enotfound|eai_again|etimedout|network is unreachable|error connecting to database/i.test(
    message,
  );
}

function normalizeDbError(e: unknown): Error {
  const message = e instanceof Error ? e.message : String(e);
  const cause = e instanceof Error ? e.cause : undefined;
  const causeMessage = cause instanceof Error ? cause.message : typeof cause === "string" ? cause : "";
  if (isNetworkish(message) || isNetworkish(causeMessage)) {
    return new Error("Network connection error. Please try again.");
  }
  return e instanceof Error ? e : new Error(message);
}

// Wraps every call made through the Neon client — tagged-template queries,
// .transaction(), .query(), .unsafe() — so a dropped connection surfaces as
// the friendly message above instead of a raw driver error.
function wrapNeonClient<T extends (...args: any[]) => any>(client: T): T {
  function attachNormalizer(result: unknown) {
    if (result && typeof (result as Promise<unknown>).then === "function") {
      return (result as Promise<unknown>).then(
        (v) => v,
        (e: unknown) => {
          throw normalizeDbError(e);
        },
      );
    }
    return result;
  }

  return new Proxy(client, {
    apply(target, thisArg, args) {
      return attachNormalizer(Reflect.apply(target, thisArg, args));
    },
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value === "function") {
        return (...args: unknown[]) => attachNormalizer(value.apply(target, args));
      }
      return value;
    },
  }) as T;
}

function createSql() {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    throw new Error(
      "Missing DATABASE_URL environment variable. Add your Neon connection string to .env.",
    );
  }
  return wrapNeonClient(neon(DATABASE_URL));
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
export const sql = new Proxy((() => {}) as unknown as ReturnType<typeof createSql>, {
  apply(_target, _thisArg, args: Parameters<ReturnType<typeof createSql>>) {
    return getSql()(...args);
  },
  get(_target, prop, receiver) {
    return Reflect.get(getSql(), prop, receiver);
  },
}) as ReturnType<typeof createSql>;
