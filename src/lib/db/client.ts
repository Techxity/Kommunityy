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

function createRawSql() {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    throw new Error(
      "Missing DATABASE_URL environment variable. Add your Neon connection string to .env.",
    );
  }
  return neon(DATABASE_URL);
}

let _rawSql: ReturnType<typeof createRawSql> | undefined;

// The genuinely unwrapped Neon client — needed for `.transaction([...])`.
// Tagging a template literal against it (`rawSql\`...\``) returns Neon's
// internal query-builder object, not a plain Promise; `.transaction()`
// inspects that object's internal shape to batch the statements into one
// request, and rejects anything else with "transaction() expects an array
// of queries...". Going through the wrapped `sql`/`getSql()` below breaks
// this, because wrapNeonClient's Proxy `apply` trap re-wraps every tagged
// template call's result through `.then()` (to attach the friendly
// network-error normalization) — which returns a plain native Promise,
// stripping the special shape `.transaction()` needs before it's ever
// awaited. There's no way to have both on the same client, so: use this
// raw client specifically when building a `.transaction([...])` array, and
// wrap the `.transaction(...)` call itself in `try { } catch (e) { throw
// normalizeDbError(e); }` if you want the same friendly error message.
export function getRawSql() {
  if (!_rawSql) _rawSql = createRawSql();
  return _rawSql;
}

type RawSqlClient = ReturnType<typeof createRawSql>;
type TransactionQueries = Parameters<RawSqlClient["transaction"]>[0];

// The one blessed way to run a multi-statement transaction. Hides the
// getRawSql() footgun (see the long note above): the callback receives the
// raw tagged-template client to BUILD statements against — building against
// the wrapped `sql` export silently breaks `.transaction()` — and the
// resulting array is run atomically, with driver errors normalized to the
// same friendly message as every other query. Callers never touch getRawSql
// or normalizeDbError directly.
//
//   await withTransaction((tx) => [
//     tx`INSERT INTO ... VALUES (${a})`,
//     tx`UPDATE ... WHERE id = ${b}`,
//   ]);
export async function withTransaction<T = unknown>(
  build: (tx: RawSqlClient) => TransactionQueries,
): Promise<T> {
  const raw = getRawSql();
  try {
    return (await raw.transaction(build(raw))) as T;
  } catch (e) {
    throw normalizeDbError(e);
  }
}

export { normalizeDbError };

let _sql: ReturnType<typeof wrapNeonClient<ReturnType<typeof createRawSql>>> | undefined;

// Tagged-template SQL client for Neon. Import like:
//   import { sql } from "@/lib/db/client";
//   const rows = await sql`SELECT * FROM communities WHERE id = ${id}`;
// Do NOT use this for `.transaction([...])` — see getRawSql() above.
export function getSql() {
  if (!_sql) _sql = wrapNeonClient(getRawSql());
  return _sql;
}

// Proxy so `sql` can be imported and used directly as a tagged template,
// mirroring the ergonomics of the old `supabaseAdmin` export.
export const sql = new Proxy((() => {}) as unknown as ReturnType<typeof getSql>, {
  apply(_target, _thisArg, args: Parameters<ReturnType<typeof getSql>>) {
    return getSql()(...args);
  },
  get(_target, prop, receiver) {
    return Reflect.get(getSql(), prop, receiver);
  },
}) as ReturnType<typeof getSql>;
