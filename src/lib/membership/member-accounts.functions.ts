import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { sql, getRawSql, normalizeDbError } from "@/lib/db/client";
import { requireAuth } from "@/lib/auth/require-auth.server";
import { communityIdForAdmin } from "@/lib/payments/communities.functions";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session.server";
import { setSessionCookie } from "@/lib/auth/session-cookie.server";
import { ensureMemberInvite, hashInviteToken } from "./member-invite.server";

// Admin: manually (re)send an account-setup invite — covers the case where
// the automatic one on approval failed (no email configured yet, bad
// address, etc).
export const resendMemberInvite = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((i) => z.object({ memberId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const communityId = await communityIdForAdmin(context.userId);
    if (!communityId) throw new Error("You don't manage a community yet.");
    const rows = await sql`
      SELECT id FROM public.members WHERE id = ${data.memberId}::uuid AND community_id = ${communityId}::uuid
    `;
    if (!rows[0]) throw new Error("Member not found.");
    // Clear any stale/expired invites so a fresh one can be issued.
    await sql`DELETE FROM public.member_invites WHERE member_id = ${data.memberId}::uuid`;
    return ensureMemberInvite(data.memberId);
  });

// Public: what to show on the "set your password" page before the member
// has typed anything in.
export const getInviteInfo = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ token: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const tokenHash = await hashInviteToken(data.token);
    const rows = await sql`
      SELECT m.name, m.email, c.name AS community_name, c.slug AS community_slug
      FROM public.member_invites mi
      JOIN public.members m ON m.id = mi.member_id
      JOIN public.communities c ON c.id = m.community_id
      WHERE mi.token_hash = ${tokenHash} AND mi.expires_at > now()
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) return null;
    return {
      name: row.name as string,
      email: (row.email as string | null) ?? "",
      communityName: row.community_name as string,
      communitySlug: row.community_slug as string,
    };
  });

// Public: sets a password, creates (or links to) a login account for this
// member, and logs them straight in.
export const acceptMemberInvite = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ token: z.string().min(10), password: z.string().min(8).max(200) }).parse(i))
  .handler(async ({ data }) => {
    const tokenHash = await hashInviteToken(data.token);
    const invites = await sql`
      SELECT mi.id AS invite_id, m.id AS member_id, m.email, m.community_id
      FROM public.member_invites mi
      JOIN public.members m ON m.id = mi.member_id
      WHERE mi.token_hash = ${tokenHash} AND mi.expires_at > now()
      LIMIT 1
    `;
    const invite = invites[0];
    if (!invite) throw new Error("This invite link is invalid or has expired.");
    if (!invite.email) throw new Error("This member has no email on file — contact your community admin.");

    const email = (invite.email as string).trim().toLowerCase();
    const passwordHash = await hashPassword(data.password);
    const existingUser = await sql`SELECT id FROM public.users WHERE email = ${email} LIMIT 1`;

    let userId: string;
    if (existingUser[0]) {
      // They already have a login (e.g. also a community_admin elsewhere) —
      // link the existing account rather than creating a duplicate.
      userId = existingUser[0].id as string;
      await sql`UPDATE public.users SET password_hash = ${passwordHash}, updated_at = now() WHERE id = ${userId}::uuid`;
    } else {
      userId = crypto.randomUUID();
      await sql`INSERT INTO public.users (id, email, password_hash) VALUES (${userId}::uuid, ${email}, ${passwordHash})`;
    }

    const rawSql = getRawSql();
    try {
      await rawSql.transaction([
        rawSql`UPDATE public.members SET user_id = ${userId}::uuid WHERE id = ${invite.member_id}::uuid`,
        rawSql`INSERT INTO public.user_roles (user_id, role, community_id) VALUES (${userId}::uuid, 'member', ${invite.community_id}::uuid) ON CONFLICT DO NOTHING`,
        rawSql`DELETE FROM public.member_invites WHERE id = ${invite.invite_id}::uuid`,
      ]);
    } catch (e) {
      throw normalizeDbError(e);
    }

    const token = await createSession(userId);
    setSessionCookie(token);

    return { ok: true };
  });
