// The daily birthday job, as an importable server function so it can run from
// a Vercel Cron route handler (src/routes/api/cron/birthdays.ts) as well as
// the standalone scripts/send-birthday-emails.mjs (Railway/local). Keep the
// two in sync if you change the behaviour — they can't share a module because
// the .mjs runs outside the TS build.
import { sql } from "@/lib/db/client";
import { sendEmailsBatch } from "@/lib/email";
import { birthdayEmail, celebrantsDigestEmail } from "@/lib/email-templates";
import { sendWhatsAppTemplate, isWhatsAppConfigured } from "@/lib/whatsapp";
import { sendCommunitySms, type SmsTarget } from "@/lib/sms/send.server";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export type BirthdayJobResult = {
  celebrants: number;
  emailSent: number;
  emailFailed: number;
  whatsappSent: number;
  whatsappFailed: number;
  smsSent: number;
  smsFailed: number;
  digestsSent: number;
  digestsFailed: number;
};

export async function runBirthdayJob(): Promise<BirthdayJobResult> {
  const now = new Date();
  const month = now.getUTCMonth() + 1;
  const day = now.getUTCDate();
  const year = now.getUTCFullYear();
  const monthName = MONTHS[month - 1];

  const rows = await sql`
    SELECT m.id, m.name, m.email, m.phone, m.whatsapp, m.sms_opt_out, c.id AS community_id, c.name AS community_name, c.birthday_messages
    FROM public.members m
    JOIN public.communities c ON c.id = m.community_id
    WHERE m.status = 'active'
      AND (m.email IS NOT NULL OR m.whatsapp IS NOT NULL OR m.phone IS NOT NULL)
      AND m.dob IS NOT NULL
      AND EXTRACT(MONTH FROM m.dob) = ${month}
      AND EXTRACT(DAY FROM m.dob) = ${day}
      AND (m.last_birthday_sent_year IS NULL OR m.last_birthday_sent_year <> ${year})
  `;

  const celebrantsByCommunity = new Map<string, { communityName: string; celebrants: { name: string; message: string }[] }>();
  const emailJobs: { id: string; to: string; subject: string; html: string; fromName: string }[] = [];
  const waJobs: { id: string; to: string; firstName: string; message: string; communityName: string }[] = [];
  const smsByCommunity = new Map<string, SmsTarget[]>();
  const waConfigured = isWhatsAppConfigured();

  for (const m of rows) {
    const name = m.name as string;
    const firstName = name.split(" ")[0];
    const communityName = m.community_name as string;
    const communityId = m.community_id as string;
    const message = (m.birthday_messages as Record<string, string> | null)?.[monthName] ?? "Happy birthday! 🎉";

    const entry = celebrantsByCommunity.get(communityId) ?? { communityName, celebrants: [] };
    entry.celebrants.push({ name, message: `Happy birthday, ${firstName}! ${message}` });
    celebrantsByCommunity.set(communityId, entry);

    if (m.email) {
      emailJobs.push({
        id: m.id as string,
        to: m.email as string,
        subject: `Happy birthday, ${firstName}!`,
        fromName: communityName,
        html: birthdayEmail({ memberName: name, communityName, message }),
      });
    }
    if (waConfigured && m.whatsapp) {
      waJobs.push({ id: m.id as string, to: m.whatsapp as string, firstName, message, communityName });
    }
    // SMS: prefer the phone field, fall back to whatsapp (also a mobile number).
    const smsPhone = (m.phone as string | null) ?? (m.whatsapp as string | null) ?? null;
    if (smsPhone) {
      const list = smsByCommunity.get(communityId) ?? [];
      list.push({ memberId: m.id as string, phone: smsPhone, optOut: !!m.sms_opt_out, body: `Happy birthday, ${firstName}! ${message}` });
      smsByCommunity.set(communityId, list);
    }
  }

  // Emails in batches; okIds tells us exactly who was accepted.
  const emailResult = await sendEmailsBatch(emailJobs);
  const sentIds = new Set(emailResult.okIds);

  // WhatsApp per member (only if configured).
  let whatsappSent = 0;
  let whatsappFailed = 0;
  for (const j of waJobs) {
    const r = await sendWhatsAppTemplate({ to: j.to, firstName: j.firstName, message: j.message, communityName: j.communityName });
    if (r.ok) {
      whatsappSent++;
      sentIds.add(j.id);
    } else {
      whatsappFailed++;
    }
  }

  // SMS per community (no-op unless SMS + the birthday channel are on). A member
  // reached by text is marked sent so they aren't messaged again this year.
  let smsSent = 0;
  let smsFailed = 0;
  for (const [communityId, targets] of smsByCommunity) {
    const r = await sendCommunitySms({ communityId, channel: "birthday", targets });
    smsSent += r.sent;
    smsFailed += r.failed;
    for (const id of r.sentMemberIds) sentIds.add(id);
  }

  if (sentIds.size > 0) {
    await sql`
      UPDATE public.members
      SET last_birthday_sent_year = ${year}, last_birthday_sent_at = now()
      WHERE id = ANY(${Array.from(sentIds)}::uuid[])
    `;
  }

  // One digest per community (only those with a celebrant today), to every
  // community_admin on file.
  let digestsSent = 0;
  let digestsFailed = 0;
  if (celebrantsByCommunity.size > 0) {
    const adminRows = await sql`
      SELECT ur.community_id, u.email
      FROM public.user_roles ur
      JOIN public.users u ON u.id = ur.user_id
      WHERE ur.role = 'community_admin' AND ur.community_id = ANY(${Array.from(celebrantsByCommunity.keys())}::uuid[])
        AND u.email IS NOT NULL
    `;
    const adminsByCommunity = new Map<string, string[]>();
    for (const a of adminRows) {
      const list = adminsByCommunity.get(a.community_id as string) ?? [];
      list.push(a.email as string);
      adminsByCommunity.set(a.community_id as string, list);
    }

    const digestJobs: { to: string; subject: string; html: string; fromName: string }[] = [];
    for (const [communityId, entry] of celebrantsByCommunity) {
      const adminEmails = Array.from(new Set(adminsByCommunity.get(communityId) ?? []));
      if (adminEmails.length === 0) continue;
      const count = entry.celebrants.length;
      const subject = count === 1 ? `1 birthday today at ${entry.communityName}` : `${count} birthdays today at ${entry.communityName}`;
      const html = celebrantsDigestEmail({ communityName: entry.communityName, celebrants: entry.celebrants });
      for (const to of adminEmails) digestJobs.push({ to, subject, html, fromName: entry.communityName });
    }
    const digestResult = await sendEmailsBatch(digestJobs);
    digestsSent = digestResult.sent;
    digestsFailed = digestResult.failed;
  }

  return {
    celebrants: rows.length,
    emailSent: emailResult.sent,
    emailFailed: emailResult.failed,
    whatsappSent,
    whatsappFailed,
    smsSent,
    smsFailed,
    digestsSent,
    digestsFailed,
  };
}
