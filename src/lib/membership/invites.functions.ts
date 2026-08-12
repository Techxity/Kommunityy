import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRequest } from "@tanstack/react-start/server";
import { requireAuth } from "@/lib/auth/require-auth.server";
import { sql } from "@/lib/db/client";
import { communityIdForAdmin } from "@/lib/payments/communities.functions";
import { sendEmail } from "@/lib/email";
import { joinInviteEmail } from "@/lib/email-templates";

// Wrapped for the same reason as session-cookie.server.ts's helpers — this
// file is reachable from the client via `.middleware([requireAuth])`, so
// any direct `@tanstack/react-start/server` usage needs the compiler's
// createServerOnlyFn transform to get stripped from the client bundle.
const getOrigin = createServerOnlyFn((): string => new URL(getRequest().url).origin);

// How long a personally-invited email is trusted to auto-approve on
// submission — after this, if they finally get around to filling the form,
// it lands as a normal pending application instead (matches ordinary invite
// hygiene: an invite from months ago shouldn't silently bypass review).
const INVITE_EMAIL_DAYS = 30;

// Emails the join-form link to a list of addresses. Requires RESEND_API_KEY
// in the environment; throws a clear, actionable error if it isn't set
// rather than failing silently.
//
// Also records each address in member_email_invites — this is what lets
// submitApplication (join.functions.ts) tell "this person was personally
// invited by the admin" apart from an organic public-link submission, so
// invited applicants can skip the pending-approval queue entirely.
export const sendInvites = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((i) => z.object({ emails: z.array(z.string().email()).min(1).max(200) }).parse(i))
  .handler(async ({ data, context }) => {
    const communityId = await communityIdForAdmin(context.userId, context.activeCommunityId);
    if (!communityId) throw new Error("You don't manage a community yet.");

    const rows = await sql`SELECT name FROM public.communities WHERE id = ${communityId}::uuid`;
    const communityName = (rows[0]?.name as string | undefined) ?? "our community";

    const origin = getOrigin();
    const joinUrl = `${origin}/join/${communityId}`;

    const expiresAt = new Date(Date.now() + INVITE_EMAIL_DAYS * 24 * 60 * 60 * 1000).toISOString();
    await Promise.all(
      data.emails.map((email) =>
        sql`
          INSERT INTO public.member_email_invites (community_id, email, expires_at)
          VALUES (${communityId}::uuid, ${email}, ${expiresAt})
          ON CONFLICT (community_id, lower(email))
          DO UPDATE SET expires_at = EXCLUDED.expires_at, consumed_at = NULL, created_at = now()
        `,
      ),
    );

    const results = await Promise.all(
      data.emails.map((email) =>
        sendEmail({
          to: email,
          subject: `You're invited to join ${communityName}`,
          fromName: communityName,
          html: joinInviteEmail({ communityName, joinUrl }),
        }),
      ),
    );

    const sent = results.filter((r) => r.ok).length;
    const failed = data.emails.filter((_, i) => !results[i]?.ok);

    if (sent === 0 && results[0]?.error) throw new Error(results[0].error);

    return { sent, failed };
  });
