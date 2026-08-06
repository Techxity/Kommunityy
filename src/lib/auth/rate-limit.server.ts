// Lightweight, DB-backed rate limiting for auth endpoints. Cloudflare
// Workers instances are ephemeral (no shared in-memory state across
// requests), so the counter has to live somewhere durable — Neon, in this
// case, via the login_attempts table.
//
// clientIp() is wrapped in createServerOnlyFn — see the note in
// session-cookie.server.ts for why this is needed (the `.server.ts` suffix
// alone doesn't strip this from the client bundle once it's reachable
// through a `.middleware([...])` reference).
import { sql } from "@/lib/db/client";
import { createServerOnlyFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

export const clientIp = createServerOnlyFn((): string => {
  const headers = getRequest().headers;
  return (
    headers.get("cf-connecting-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
});

// Throws if `identifier` has made >= max attempts within the last
// `windowMs`. Call this BEFORE doing the expensive work (password hashing),
// then call recordAttempt() after, regardless of outcome.
export async function assertNotRateLimited(
  identifier: string,
  max: number,
  windowMs: number,
): Promise<void> {
  const since = new Date(Date.now() - windowMs).toISOString();
  const rows = await sql`
    SELECT count(*)::int AS n FROM public.login_attempts
    WHERE identifier = ${identifier} AND attempted_at > ${since}
  `;
  if ((rows[0]?.n ?? 0) >= max) {
    throw new Error("Too many attempts. Please wait a few minutes and try again.");
  }
}

export async function recordAttempt(identifier: string): Promise<void> {
  await sql`INSERT INTO public.login_attempts (identifier) VALUES (${identifier})`;
}
