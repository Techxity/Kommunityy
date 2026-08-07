import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { sql } from "@/lib/db/client";
import { requireAuth } from "@/lib/auth/require-auth.server";
import { communityIdForAdmin } from "@/lib/payments/communities.functions";
import { sendEmail } from "@/lib/email";
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

    const results = await Promise.all(
      members.map((m) => sendEmail({ to: m.email as string, subject: data.subject, html, fromName: communityName })),
    );
    const sent = results.filter((r) => r.ok).length;
    if (members.length > 0 && sent === 0 && results[0]?.error) throw new Error(results[0].error);

    await sql`
      INSERT INTO public.broadcasts (community_id, subject, body, reach)
      VALUES (${communityId}::uuid, ${data.subject}, ${data.body}, ${sent})
    `;

    return { sent, total: members.length };
  });
