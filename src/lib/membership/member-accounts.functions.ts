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

// Public: sets a password, creates a login account for this member, and logs
// them straight in.
//
// SECURITY: an invite is only ever a claim on a *brand-new* account for the
// invited email. If a user already exists for that email, we refuse — we do
// NOT reset that user's password or start a session for them. Otherwise a
// community admin (who can add a member with any email, and read the invite
// link) could add a member row carrying a victim's email, open the link, set
// a password, and take over the victim's existing account — including a
// super_admin. Existing users who should also be a member get linked through
// an authenticated path (linkExistingAccountToMembership) instead, which
// proves control of the account via the current session.
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
    const existingUser = await sql`SELECT id FROM public.users WHERE email = ${email} LIMIT 1`;
    if (existingUser[0]) {
      // Never touch an existing account's credentials via an invite. The
      // person must sign in with the password they already have; once signed
      // in they can claim the membership through the authenticated path.
      throw new Error(
        "An account already exists for this email. Please sign in with your existing password — your membership will be linked automatically.",
      );
    }

    const passwordHash = await hashPassword(data.password);
    const userId = crypto.randomUUID();
    await sql`INSERT INTO public.users (id, email, password_hash) VALUES (${userId}::uuid, ${email}, ${passwordHash})`;

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

// Authenticated path for an existing user to claim a pending membership whose
// email matches their own account. Because it runs under requireAuth and only
// ever links the caller's OWN session to a member row bearing the caller's own
// verified email, it can't be used to attach to someone else's account — which
// is exactly why acceptMemberInvite refuses existing accounts and defers here.
export const linkExistingAccountToMembership = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((i) => z.object({ token: z.string().min(10) }).parse(i))
  .handler(async ({ data, context }) => {
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

    const inviteEmail = (invite.email as string | null)?.trim().toLowerCase();
    const userRows = await sql`SELECT email FROM public.users WHERE id = ${context.userId}::uuid LIMIT 1`;
    const myEmail = (userRows[0]?.email as string | null)?.trim().toLowerCase();
    // The signed-in user may only claim an invite addressed to their own email.
    if (!inviteEmail || !myEmail || inviteEmail !== myEmail) {
      throw new Error("This invite is for a different email address than the account you're signed in to.");
    }

    const rawSql = getRawSql();
    try {
      await rawSql.transaction([
        rawSql`UPDATE public.members SET user_id = ${context.userId}::uuid WHERE id = ${invite.member_id}::uuid`,
        rawSql`INSERT INTO public.user_roles (user_id, role, community_id) VALUES (${context.userId}::uuid, 'member', ${invite.community_id}::uuid) ON CONFLICT DO NOTHING`,
        rawSql`DELETE FROM public.member_invites WHERE id = ${invite.invite_id}::uuid`,
      ]);
    } catch (e) {
      throw normalizeDbError(e);
    }
    return { ok: true };
  });
