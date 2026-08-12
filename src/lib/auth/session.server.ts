// DB-backed sessions. The raw token only ever lives in the user's cookie —
// we store a SHA-256 hash of it in Neon, so a DB leak alone doesn't hand out
// usable session tokens.
//
// `.server.ts` suffix: holds a direct DB connection (via @/lib/db/client)
// and has no business ever reaching the client bundle — see the note in
// session-cookie.server.ts.
import { sql } from "@/lib/db/client";

const SESSION_DAYS = 30;

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function createSession(userId: string): Promise<string> {
  const token = randomToken();
  const tokenHash = await hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await sql`
    INSERT INTO public.sessions (user_id, token_hash, expires_at)
    VALUES (${userId}::uuid, ${tokenHash}, ${expiresAt})
  `;
  return token;
}

export async function verifySessionToken(
  token: string,
): Promise<{ userId: string; activeCommunityId: string | null } | null> {
  const tokenHash = await hashToken(token);
  const rows = await sql`
    SELECT user_id, active_community_id FROM public.sessions
    WHERE token_hash = ${tokenHash} AND expires_at > now()
    LIMIT 1
  `;
  const row = rows[0];
  return row
    ? { userId: row.user_id as string, activeCommunityId: (row.active_community_id as string | null) ?? null }
    : null;
}

// Pins this session to a community (the member's currently-viewed one). Looked
// up by the same token hash the cookie carries.
export async function setSessionActiveCommunity(token: string, communityId: string | null): Promise<void> {
  const tokenHash = await hashToken(token);
  await sql`UPDATE public.sessions SET active_community_id = ${communityId} WHERE token_hash = ${tokenHash}`;
}

export async function revokeSessionToken(token: string): Promise<void> {
  const tokenHash = await hashToken(token);
  await sql`DELETE FROM public.sessions WHERE token_hash = ${tokenHash}`;
}

// Called on login / password change / role grant to invalidate any other
// sessions that might exist for this user (session-fixation defense).
export async function revokeAllSessionsForUser(userId: string): Promise<void> {
  await sql`DELETE FROM public.sessions WHERE user_id = ${userId}::uuid`;
}
