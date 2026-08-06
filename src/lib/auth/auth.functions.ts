import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { sql, getSql } from "@/lib/db/client";
import { hashPassword, verifyPassword, DUMMY_PASSWORD_HASH } from "./password";
import { createSession, revokeAllSessionsForUser, revokeSessionToken } from "./session.server";
import { setSessionCookie, clearSessionCookie, readSessionToken } from "./session-cookie.server";
import { assertNotRateLimited, recordAttempt, clientIp } from "./rate-limit.server";
import { getSessionUser } from "./require-auth.server";

async function rolesFor(userId: string) {
  const rows = await sql`
    SELECT role, community_id FROM public.user_roles WHERE user_id = ${userId}::uuid
  `;
  const isSuperAdmin = rows.some((r) => r.role === "super_admin");
  const communityAdminOf = (rows.find((r) => r.role === "community_admin")?.community_id as string | undefined) ?? null;
  const memberOf = (rows.find((r) => r.role === "member")?.community_id as string | undefined) ?? null;
  return { isSuperAdmin, communityAdminOf, isMember: !!memberOf, memberOf };
}

// Creates a brand-new community together with its first (community_admin)
// user account, then logs them in.
export const signup = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z
      .object({
        communityName: z.string().min(2).max(120),
        communityType: z.string().max(60).optional(),
        name: z.string().min(1).max(120),
        email: z.string().email().max(200),
        password: z.string().min(8).max(200),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const ip = clientIp();
    await assertNotRateLimited(`signup:${ip}`, 10, 60 * 60 * 1000);
    await recordAttempt(`signup:${ip}`);

    const email = data.email.trim().toLowerCase();
    const existing = await sql`SELECT id FROM public.users WHERE email = ${email} LIMIT 1`;
    if (existing[0]) throw new Error("An account with that email already exists.");

    const passwordHash = await hashPassword(data.password);
    const userId = crypto.randomUUID();
    const communityId = crypto.randomUUID();
    // Matches the "14-day Enterprise trial" promised on the signup page.
    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    const rawSql = getSql();
    try {
      await rawSql.transaction([
        rawSql`INSERT INTO public.users (id, email, password_hash, name) VALUES (${userId}::uuid, ${email}, ${passwordHash}, ${data.name})`,
        rawSql`INSERT INTO public.communities (id, name, type, trial_ends_at) VALUES (${communityId}::uuid, ${data.communityName}, ${data.communityType ?? null}, ${trialEndsAt})`,
        rawSql`INSERT INTO public.user_roles (user_id, role, community_id) VALUES (${userId}::uuid, 'community_admin', ${communityId}::uuid)`,
      ]);
    } catch (e: any) {
      if (String(e?.message ?? "").toLowerCase().includes("unique")) {
        throw new Error("An account with that email already exists.");
      }
      throw new Error("Could not create your account — please try again.");
    }

    const token = await createSession(userId);
    setSessionCookie(token);
    return { ok: true, communityId };
  });

export const login = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z.object({ email: z.string().email().max(200), password: z.string().min(1).max(200) }).parse(i),
  )
  .handler(async ({ data }) => {
    const ip = clientIp();
    const email = data.email.trim().toLowerCase();
    await assertNotRateLimited(`login:ip:${ip}`, 20, 15 * 60 * 1000);
    await assertNotRateLimited(`login:email:${email}`, 8, 15 * 60 * 1000);

    const rows = await sql`SELECT id, password_hash FROM public.users WHERE email = ${email} LIMIT 1`;
    const user = rows[0];
    // Always run the hash compare, even when the user doesn't exist, so the
    // response time doesn't leak whether the email has an account.
    const hashToCheck = (user?.password_hash as string | undefined) ?? DUMMY_PASSWORD_HASH;
    const passwordMatches = await verifyPassword(data.password, hashToCheck);

    await recordAttempt(`login:ip:${ip}`);
    await recordAttempt(`login:email:${email}`);

    if (!user || !passwordMatches) {
      throw new Error("Invalid email or password.");
    }

    // Session rotation: kill any pre-existing sessions, issue a fresh one.
    await revokeAllSessionsForUser(user.id as string);
    const token = await createSession(user.id as string);
    setSessionCookie(token);

    const roles = await rolesFor(user.id as string);
    return { ok: true, ...roles };
  });

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  const token = readSessionToken();
  if (token) await revokeSessionToken(token);
  clearSessionCookie();
  return { ok: true };
});

// Public: current session, or null. Used for route guards and shell UI —
// not a substitute for `requireAuth` on server functions that touch private
// data (see the note in the middleware guide about beforeLoad vs. the data
// boundary).
export const me = createServerFn({ method: "POST" }).handler(async () => {
  const session = await getSessionUser();
  if (!session) return null;
  const rows = await sql`
    SELECT id, email, name FROM public.users WHERE id = ${session.userId}::uuid LIMIT 1
  `;
  const user = rows[0];
  if (!user) return null;
  const roles = await rolesFor(session.userId);
  return { id: user.id as string, email: user.email as string, name: (user.name as string | null) ?? null, ...roles };
});
