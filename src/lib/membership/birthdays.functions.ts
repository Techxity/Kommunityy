import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { sql } from "@/lib/db/client";
import { requireAuth } from "@/lib/auth/require-auth.server";
import { communityIdForAdmin } from "@/lib/payments/communities.functions";
import { sendEmail } from "@/lib/email";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

export const getBirthdayMessages = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const communityId = await communityIdForAdmin(context.userId);
    if (!communityId) return {};
    const rows = await sql`SELECT birthday_messages FROM public.communities WHERE id = ${communityId}::uuid`;
    return (rows[0]?.birthday_messages as Record<string, string> | undefined) ?? {};
  });

export const saveBirthdayMessage = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((i) => z.object({ month: z.enum(MONTHS), message: z.string().max(2000) }).parse(i))
  .handler(async ({ data, context }) => {
    const communityId = await communityIdForAdmin(context.userId);
    if (!communityId) throw new Error("You don't manage a community yet.");
    await sql`
      UPDATE public.communities
      SET birthday_messages = jsonb_set(birthday_messages, ${[data.month]}::text[], to_jsonb(${data.message}::text)),
          updated_at = now()
      WHERE id = ${communityId}::uuid
    `;
    return { ok: true };
  });

// Active members who have a date of birth on file — the admin page filters
// this client-side by month/day, same as before, just backed by real data.
export const listMembersWithBirthdays = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const communityId = await communityIdForAdmin(context.userId);
    if (!communityId) return [];
    const rows = await sql`
      SELECT id, name, email, dob
      FROM public.members
      WHERE community_id = ${communityId}::uuid AND status = 'active' AND dob IS NOT NULL
      ORDER BY name ASC
    `;
    return rows.map((r) => ({
      id: r.id as string,
      name: r.name as string,
      email: (r.email as string | null) ?? "",
      dob: new Date(r.dob as string).toISOString().slice(0, 10),
    }));
  });

export const sendBirthdayEmails = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((i) => z.object({ memberIds: z.array(z.string().uuid()).min(1) }).parse(i))
  .handler(async ({ data, context }) => {
    const communityId = await communityIdForAdmin(context.userId);
    if (!communityId) throw new Error("You don't manage a community yet.");

    const communities = await sql`SELECT name, birthday_messages FROM public.communities WHERE id = ${communityId}::uuid`;
    const community = communities[0];
    if (!community) throw new Error("Community not found.");

    const month = MONTHS[new Date().getMonth()];
    const message = ((community.birthday_messages as Record<string, string> | null)?.[month]) ?? "Happy birthday! 🎉";
    const communityName = community.name as string;

    const members = await sql`
      SELECT id, name, email FROM public.members
      WHERE community_id = ${communityId}::uuid AND status = 'active' AND id = ANY(${data.memberIds}::uuid[]) AND email IS NOT NULL
    `;

    const results = await Promise.all(
      members.map((m) =>
        sendEmail({
          to: m.email as string,
          subject: `Happy birthday, ${(m.name as string).split(" ")[0]}! 🎂`,
          fromName: communityName,
          html: `
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #111827;">
              <p>Dear ${m.name},</p>
              <p>${message}</p>
              <p style="color:#6b7280;font-size:13px; margin-top: 24px;">— ${communityName}</p>
            </div>
          `,
        }),
      ),
    );

    const sent = results.filter((r) => r.ok).length;
    if (sent === 0 && results[0]?.error) throw new Error(results[0].error);
    return { sent, total: members.length };
  });
