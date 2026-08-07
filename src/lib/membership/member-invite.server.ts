// Shared server-only helper for member account invites. getOrigin() is
// wrapped in createServerOnlyFn — see the note in
// src/lib/auth/session-cookie.server.ts for why that's needed (the
// `.server.ts` suffix alone doesn't strip `@tanstack/react-start/server`
// usage from the client bundle once this module is reachable through a
// `.middleware([...])` reference elsewhere in the app).
import { createServerOnlyFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { sql } from "@/lib/db/client";
import { sendEmail } from "@/lib/email";
import { memberAccountReadyEmail } from "@/lib/email-templates";

const getOrigin = createServerOnlyFn((): string => new URL(getRequest().url).origin);

const INVITE_DAYS = 7;

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function hashInviteToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Creates a member account invite and emails it, unless the member already
// has an account, has no email on file, or already has a live invite
// pending. Called automatically when a member is approved/activated, and
// manually via resendMemberInvite for retries.
export async function ensureMemberInvite(
  memberId: string,
): Promise<{ created: boolean; emailSent?: boolean; link?: string; reason?: string }> {
  const rows = await sql`
    SELECT m.id, m.name, m.email, m.user_id, c.name AS community_name
    FROM public.members m
    JOIN public.communities c ON c.id = m.community_id
    WHERE m.id = ${memberId}::uuid
  `;
  const member = rows[0];
  if (!member) return { created: false, reason: "Member not found." };
  if (member.user_id) return { created: false, reason: "Already has an account." };
  if (!member.email) return { created: false, reason: "No email on file." };

  const existing = await sql`
    SELECT id FROM public.member_invites WHERE member_id = ${memberId}::uuid AND expires_at > now() LIMIT 1
  `;
  if (existing[0]) return { created: false, reason: "An invite is already pending." };

  const token = randomToken();
  const tokenHash = await hashInviteToken(token);
  const expiresAt = new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await sql`
    INSERT INTO public.member_invites (member_id, token_hash, expires_at)
    VALUES (${memberId}::uuid, ${tokenHash}, ${expiresAt})
  `;

  const origin = getOrigin();
  const link = `${origin}/invite/${token}`;

  const result = await sendEmail({
    to: member.email as string,
    subject: `You're in! Set your password for ${member.community_name}`,
    fromName: member.community_name as string,
    html: memberAccountReadyEmail({
      memberName: member.name as string,
      communityName: member.community_name as string,
      setupUrl: link,
    }),
  });

  return { created: true, emailSent: result.ok, link };
}
