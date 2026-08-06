import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRequest } from "@tanstack/react-start/server";
import { requireAuth } from "@/lib/auth/require-auth.server";
import { sql } from "@/lib/db/client";
import { communityIdForAdmin } from "@/lib/payments/communities.functions";
import { sendEmail } from "@/lib/email";

// Wrapped for the same reason as session-cookie.server.ts's helpers — this
// file is reachable from the client via `.middleware([requireAuth])`, so
// any direct `@tanstack/react-start/server` usage needs the compiler's
// createServerOnlyFn transform to get stripped from the client bundle.
const getOrigin = createServerOnlyFn((): string => new URL(getRequest().url).origin);

// Emails the join-form link to a list of addresses. Requires RESEND_API_KEY
// in the environment; throws a clear, actionable error if it isn't set
// rather than failing silently.
export const sendInvites = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((i) => z.object({ emails: z.array(z.string().email()).min(1).max(200) }).parse(i))
  .handler(async ({ data, context }) => {
    const communityId = await communityIdForAdmin(context.userId);
    if (!communityId) throw new Error("You don't manage a community yet.");

    const rows = await sql`SELECT name FROM public.communities WHERE id = ${communityId}::uuid`;
    const communityName = (rows[0]?.name as string | undefined) ?? "our community";

    const origin = getOrigin();
    const joinUrl = `${origin}/join/${communityId}`;

    const results = await Promise.all(
      data.emails.map((email) =>
        sendEmail({
          to: email,
          subject: `You're invited to join ${communityName}`,
          fromName: communityName,
          html: `
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #111827;">
              <p>Hi,</p>
              <p><strong>${communityName}</strong> has invited you to join their community.</p>
              <p style="margin: 24px 0;">
                <a href="${joinUrl}" style="background:#111827;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:600;display:inline-block;">
                  Fill out the join form
                </a>
              </p>
              <p style="color:#6b7280;font-size:13px;">Or copy this link into your browser: ${joinUrl}</p>
            </div>
          `,
        }),
      ),
    );

    const sent = results.filter((r) => r.ok).length;
    const failed = data.emails.filter((_, i) => !results[i]?.ok);

    if (sent === 0 && results[0]?.error) throw new Error(results[0].error);

    return { sent, failed };
  });
