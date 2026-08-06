#!/usr/bin/env node
// Standalone daily job: emails every active member whose birthday is today,
// across every community, then marks them sent so a second run the same day
// is a no-op. Talks to Neon and Resend directly over HTTP — no dependency on
// the TanStack Start app itself, so it can run as its own Railway cron
// service (or a local Task Scheduler job) independent of the web process.
//
// Requires DATABASE_URL and RESEND_API_KEY in the environment (same values
// the main app uses). Locally:
//   node --env-file=.env scripts/send-birthday-emails.mjs
// On Railway, set it as a Cron Job service's start command:
//   node scripts/send-birthday-emails.mjs
// (Railway injects the shared env vars automatically — no --env-file needed.)

import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
// Same sender-branding rule as src/lib/email.ts: everyone sends from one
// verified Resend address, but the display name is per-community so
// recipients see "Irewole Estate" rather than the platform's name.
const RESEND_FROM_ADDRESS =
  process.env.RESEND_FROM_ADDRESS ||
  process.env.RESEND_FROM_EMAIL?.match(/<([^>]+)>/)?.[1] ||
  "onboarding@resend.dev";

if (!DATABASE_URL) {
  console.error("Missing DATABASE_URL — aborting.");
  process.exit(1);
}
if (!RESEND_API_KEY) {
  console.error("Missing RESEND_API_KEY — aborting.");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

async function sendEmail({ to, subject, html, fromName }) {
  const from = `${fromName ?? "Kinfolk"} <${RESEND_FROM_ADDRESS}>`;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, html }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `${res.status}: ${body}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e?.message ?? "Unknown error sending email." };
  }
}

async function main() {
  const now = new Date();
  const month = now.getUTCMonth() + 1; // 1-12
  const day = now.getUTCDate();
  const year = now.getUTCFullYear();
  const monthName = MONTHS[month - 1];

  const rows = await sql`
    SELECT m.id, m.name, m.email, c.name AS community_name, c.birthday_messages
    FROM public.members m
    JOIN public.communities c ON c.id = m.community_id
    WHERE m.status = 'active'
      AND m.email IS NOT NULL
      AND m.dob IS NOT NULL
      AND EXTRACT(MONTH FROM m.dob) = ${month}
      AND EXTRACT(DAY FROM m.dob) = ${day}
      AND (m.last_birthday_sent_year IS NULL OR m.last_birthday_sent_year <> ${year})
  `;

  console.log(`[birthdays] ${now.toISOString()} — ${rows.length} celebrant(s) found for ${monthName} ${day}.`);

  let sent = 0;
  let failed = 0;

  for (const m of rows) {
    const message = m.birthday_messages?.[monthName] ?? "Happy birthday! 🎉";
    const result = await sendEmail({
      to: m.email,
      subject: `Happy birthday, ${String(m.name).split(" ")[0]}! 🎂`,
      fromName: m.community_name,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #111827;">
          <p>Dear ${m.name},</p>
          <p>${message}</p>
          <p style="color:#6b7280;font-size:13px; margin-top: 24px;">— ${m.community_name}</p>
        </div>
      `,
    });

    if (result.ok) {
      sent++;
      await sql`UPDATE public.members SET last_birthday_sent_year = ${year} WHERE id = ${m.id}::uuid`;
    } else {
      failed++;
      console.error(`[birthdays] Failed to email ${m.email}: ${result.error}`);
    }
  }

  console.log(`[birthdays] Done. Sent ${sent}, failed ${failed}.`);
  if (failed > 0 && sent === 0) process.exit(1);
}

main().catch((err) => {
  console.error("[birthdays] Fatal error:", err);
  process.exit(1);
});
