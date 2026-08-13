import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { sql } from "@/lib/db/client";
import { requireAuth } from "@/lib/auth/require-auth.server";
import { communityIdForAdmin } from "@/lib/payments/communities.functions";
import { resolveActiveMember } from "./active-member.server";
import { sendEmailsBatch } from "@/lib/email";
import { broadcastEmail } from "@/lib/email-templates";
import { sendCommunitySms, type SmsTarget } from "@/lib/sms/send.server";

export const listBroadcasts = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const communityId = await communityIdForAdmin(context.userId, context.activeCommunityId);
    if (!communityId) return [];
    const rows = await sql`
      SELECT id, subject, reach, sent_at
      FROM public.broadcasts
      WHERE community_id = ${communityId}::uuid
      ORDER BY sent_at DESC
      LIMIT 20
    `;
    return rows.map((r) => ({
      id: r.id as string,
      title: r.subject as string,
      date: new Date(r.sent_at as string).toLocaleDateString(),
      reach: r.reach as number,
    }));
  });

// Member: recent announcements for the logged-in member's own community —
// powers the member dashboard's "Latest updates" widget and /member/updates.
// Unlike listBroadcasts (admin-only), this resolves the community from the
// member's own user_id link rather than requiring a community_admin role.
export const listMyBroadcasts = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const active = await resolveActiveMember(context.userId, context.activeCommunityId);
    if (!active) return [];
    const rows = await sql`
      SELECT b.id, b.subject, b.body, b.sent_at
      FROM public.broadcasts b
      WHERE b.community_id = ${active.communityId}::uuid
      ORDER BY b.sent_at DESC
      LIMIT 20
    `;
    return rows.map((r) => ({
      id: r.id as string,
      title: r.subject as string,
      body: r.body as string,
      date: new Date(r.sent_at as string).toLocaleDateString(),
    }));
  });

export const sendBroadcast = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((i) =>
    z
      .object({
        subject: z.string().min(1).max(200),
        body: z.string().min(1).max(10000),
        viaEmail: z.boolean().default(true),
        viaSms: z.boolean().default(false),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const communityId = await communityIdForAdmin(context.userId, context.activeCommunityId);
    if (!communityId) throw new Error("You don't manage a community yet.");
    if (!data.viaEmail && !data.viaSms) throw new Error("Pick at least one channel (email or SMS).");

    const communities = await sql`SELECT name FROM public.communities WHERE id = ${communityId}::uuid`;
    const communityName = (communities[0]?.name as string | undefined) ?? "your community";

    let emailSent = 0;
    let emailTotal = 0;
    if (data.viaEmail) {
      const members = await sql`
        SELECT email FROM public.members
        WHERE community_id = ${communityId}::uuid AND status = 'active' AND email IS NOT NULL
      `;
      emailTotal = members.length;
      const html = broadcastEmail({ communityName, bodyText: data.body });
      // Batched send — one HTTP call per 100 recipients, a few in parallel.
      const res = await sendEmailsBatch(
        members.map((m) => ({ to: m.email as string, subject: data.subject, html, fromName: communityName })),
      );
      emailSent = res.sent;
      if (members.length > 0 && emailSent === 0 && !data.viaSms) {
        throw new Error("Couldn't send the broadcast right now. Please try again.");
      }
    }

    // SMS channel (no-op unless SMS + the broadcasts channel are on). Sends the
    // raw body to every active member with a phone number.
    let smsSent = 0;
    if (data.viaSms) {
      const smsRows = await sql`
        SELECT id, phone, sms_opt_out FROM public.members
        WHERE community_id = ${communityId}::uuid AND status = 'active' AND phone IS NOT NULL
      `;
      const targets: SmsTarget[] = smsRows.map((m) => ({
        memberId: m.id as string,
        phone: m.phone as string,
        optOut: !!m.sms_opt_out,
        body: data.body,
      }));
      const r = await sendCommunitySms({ communityId, channel: "broadcast", targets });
      smsSent = r.sent;
    }

    const reach = Math.max(emailSent, smsSent);
    await sql`
      INSERT INTO public.broadcasts (community_id, subject, body, reach)
      VALUES (${communityId}::uuid, ${data.subject}, ${data.body}, ${reach})
    `;

    return { sent: emailSent, total: emailTotal, smsSent };
  });
