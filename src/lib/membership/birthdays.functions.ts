import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { sql } from "@/lib/db/client";
import { requireAuth } from "@/lib/auth/require-auth.server";
import { communityIdForAdmin } from "@/lib/payments/communities.functions";
import { sendEmail } from "@/lib/email";
import { birthdayEmail } from "@/lib/email-templates";
import { sendWhatsAppTemplate, isWhatsAppConfigured } from "@/lib/whatsapp";

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
      SELECT id, name, email, whatsapp, dob
      FROM public.members
      WHERE community_id = ${communityId}::uuid AND status = 'active' AND dob IS NOT NULL
      ORDER BY name ASC
    `;
    return rows.map((r) => ({
      id: r.id as string,
      name: r.name as string,
      email: (r.email as string | null) ?? "",
      whatsapp: (r.whatsapp as string | null) ?? "",
      // String-sliced, not `new Date(...)`-parsed — see the note on
      // toDateString in members.functions.ts for why: round-tripping a bare
      // calendar date through a JS Date can silently shift it by a day
      // depending on the local timezone of whoever's browser renders it.
      dob: String(r.dob).slice(0, 10),
    }));
  });

// Sends the birthday message on every channel a member has on file — email
// via Resend, and WhatsApp via Meta's Cloud API when WHATSAPP_ACCESS_TOKEN /
// WHATSAPP_PHONE_NUMBER_ID are configured (see src/lib/whatsapp.ts for the
// one-time Meta setup this depends on). Each channel succeeds or fails
// independently: a member with only a phone number still gets their
// WhatsApp message even if they have no email, and vice versa.
export const sendBirthdayMessages = createServerFn({ method: "POST" })
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

    // CC the admin who triggered this (they're always a community_admin —
    // requireAuth + communityIdForAdmin above already confirmed it) so they
    // get a copy in their own inbox as confirmation the send actually went
    // out, without needing to check a log.
    const adminRows = await sql`SELECT email FROM public.users WHERE id = ${context.userId}::uuid`;
    const adminEmail = (adminRows[0]?.email as string | undefined) ?? undefined;

    const members = await sql`
      SELECT id, name, email, whatsapp FROM public.members
      WHERE community_id = ${communityId}::uuid AND status = 'active' AND id = ANY(${data.memberIds}::uuid[])
        AND (email IS NOT NULL OR whatsapp IS NOT NULL)
    `;

    const withEmail = members.filter((m) => m.email);
    const emailResults = await Promise.all(
      withEmail.map((m) =>
        sendEmail({
          to: m.email as string,
          subject: `Happy birthday, ${(m.name as string).split(" ")[0]}! 🎂`,
          fromName: communityName,
          html: birthdayEmail({ memberName: m.name as string, communityName, message }),
          cc: adminEmail,
        }),
      ),
    );

    const waConfigured = isWhatsAppConfigured();
    const withWhatsApp = waConfigured ? members.filter((m) => m.whatsapp) : [];
    const whatsappResults = await Promise.all(
      withWhatsApp.map((m) =>
        sendWhatsAppTemplate({
          to: m.whatsapp as string,
          firstName: (m.name as string).split(" ")[0],
          message,
          communityName,
        }),
      ),
    );

    const emailSentIds = withEmail.filter((_, i) => emailResults[i]?.ok).map((m) => m.id as string);
    const whatsappSentIds = withWhatsApp.filter((_, i) => whatsappResults[i]?.ok).map((m) => m.id as string);
    const anySentIds = Array.from(new Set([...emailSentIds, ...whatsappSentIds]));

    if (anySentIds.length > 0) {
      await sql`
        UPDATE public.members
        SET last_birthday_sent_year = EXTRACT(YEAR FROM CURRENT_DATE)::int, last_birthday_sent_at = now()
        WHERE id = ANY(${anySentIds}::uuid[])
      `;
    }

    const emailSent = emailResults.filter((r) => r.ok).length;
    const whatsappSent = whatsappResults.filter((r) => r.ok).length;

    // Only throw (and block the "Sent" UI state) if literally nothing went
    // out on either channel — a partial success (e.g. email ok, WhatsApp
    // template not yet approved) should still read as a send, not an error.
    if (emailSent === 0 && whatsappSent === 0 && members.length > 0) {
      const firstError = emailResults[0]?.error || whatsappResults[0]?.error;
      if (firstError) throw new Error(firstError);
    }

    return {
      total: members.length,
      emailSent,
      emailTotal: withEmail.length,
      whatsappSent,
      whatsappTotal: withWhatsApp.length,
      whatsappConfigured: waConfigured,
    };
  });
