import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { sql } from "@/lib/db/client";
import { requireAuth } from "@/lib/auth/require-auth.server";
import { communityIdForAdmin } from "@/lib/payments/communities.functions";
import { sendEmailsBatch } from "@/lib/email";
import { broadcastEmail } from "@/lib/email-templates";

export const listBroadcasts = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const communityId = await communityIdForAdmin(context.userId);
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
    const rows = await sql`
      SELECT b.id, b.subject, b.body, b.sent_at
      FROM public.broadcasts b
      JOIN public.members m ON m.community_id = b.community_id
      WHERE m.user_id = ${context.userId}::uuid AND m.status = 'active'
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
  .inputValidator((i) => z.object({ subject: z.string().min(1).max(200), body: z.string().min(1).max(10000) }).parse(i))
  .handler(async ({ data, context }) => {
    const communityId = await communityIdForAdmin(context.userId);
    if (!communityId) throw new Error("You don't manage a community yet.");

    const communities = await sql`SELECT name FROM public.communities WHERE id = ${communityId}::uuid`;
    const communityName = (communities[0]?.name as string | undefined) ?? "your community";

    const members = await sql`
      SELECT email FROM public.members
      WHERE community_id = ${communityId}::uuid AND status = 'active' AND email IS NOT NULL
    `;

    const html = broadcastEmail({ communityName, bodyText: data.body });

    // Batched send (see sendEmailsBatch) — one HTTP call per 100 recipients,
    // a few in parallel, instead of one request per member.
    const { sent } = await sendEmailsBatch(
      members.map((m) => ({ to: m.email as string, subject: data.subject, html, fromName: communityName })),
    );
    if (members.length > 0 && sent === 0) {
      throw new Error("Couldn't send the broadcast right now. Please try again.");
    }

    await sql`
      INSERT INTO public.broadcasts (community_id, subject, body, reach)
      VALUES (${communityId}::uuid, ${data.subject}, ${data.body}, ${sent})
    `;

    return { sent, total: members.length };
  });
