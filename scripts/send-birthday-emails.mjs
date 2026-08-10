#!/usr/bin/env node
// Standalone daily job: messages every active member whose birthday is
// today, across every community, on every channel they have on file (email
// via Resend, WhatsApp via Meta's Cloud API), then marks them sent so a
// second run the same day is a no-op. Also sends one digest email per
// community (to every community_admin on file) listing all of that
// community's celebrants for the day, with a ready-to-paste WhatsApp
// message per celebrant — admins share it in their own group manually,
// which costs nothing, instead of relying solely on the paid per-member
// WhatsApp send below. Talks to Neon/Resend/Meta directly over HTTP — no
// dependency on the TanStack Start app itself, so it can run as its own
// Railway cron service (or a local Task Scheduler job) independent of the
// web process.
//
// Requires DATABASE_URL and RESEND_API_KEY in the environment (same values
// the main app uses). Locally:
//   node --env-file=.env scripts/send-birthday-emails.mjs
// On Railway, set it as a Cron Job service's start command:
//   node scripts/send-birthday-emails.mjs
// (Railway injects the shared env vars automatically — no --env-file needed.)
//
// WhatsApp is optional and off by default: set WHATSAPP_ACCESS_TOKEN and
// WHATSAPP_PHONE_NUMBER_ID to turn on the paid per-member send (see
// src/lib/whatsapp.ts for the one-time Meta setup this depends on). Without
// them, this script only sends the per-member email plus the admin digest
// below — no WhatsApp Business API cost at all.

import { neon } from "@neondatabase/serverless";
import { birthdayEmail, celebrantsDigestEmail } from "./lib/email-templates.mjs";

const DATABASE_URL = process.env.DATABASE_URL;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
// Same sender-branding rule as src/lib/email.ts: everyone sends from one
// verified Resend address, but the display name is per-community so
// recipients see "Irewole Estate" rather than the platform's name.
const RESEND_FROM_ADDRESS =
  process.env.RESEND_FROM_ADDRESS ||
  process.env.RESEND_FROM_EMAIL?.match(/<([^>]+)>/)?.[1] ||
  "onboarding@resend.dev";

const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const WHATSAPP_TEMPLATE_NAME = process.env.WHATSAPP_TEMPLATE_NAME || "birthday_wish";
const WHATSAPP_TEMPLATE_LANG = process.env.WHATSAPP_TEMPLATE_LANG || "en";
const WHATSAPP_CONFIGURED = Boolean(WHATSAPP_ACCESS_TOKEN && WHATSAPP_PHONE_NUMBER_ID);

if (!DATABASE_URL) {
  console.error("Missing DATABASE_URL — aborting.");
  process.exit(1);
}
if (!RESEND_API_KEY) {
  console.error("Missing RESEND_API_KEY — aborting.");
  process.exit(1);
}
if (!WHATSAPP_CONFIGURED) {
  console.log("[birthdays] WhatsApp not configured (WHATSAPP_ACCESS_TOKEN/WHATSAPP_PHONE_NUMBER_ID unset) — email only.");
}

const sql = neon(DATABASE_URL);

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

async function sendEmail({ to, subject, html, fromName, cc }) {
  const from = `${fromName ?? "Kinfolk"} <${RESEND_FROM_ADDRESS}>`;
  const ccList = cc && cc.toLowerCase() !== to.toLowerCase() ? [cc] : [];
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, html, ...(ccList.length > 0 ? { cc: ccList } : {}) }),
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

// Mirrors src/lib/whatsapp.ts — see that file for the one-time Meta setup
// (template name/body, access token) this depends on. Kept inline here
// rather than shared, since it's a small, self-contained fetch call and the
// two entry points (app server functions vs. this standalone script) can't
// share a .ts module anyway.
function normalizeWhatsAppNumber(raw) {
  const digits = String(raw ?? "").replace(/[^\d]/g, "");
  if (!digits) return null;
  if (String(raw).trim().startsWith("+")) return digits;
  if (digits.length > 11) return digits;
  return null;
}

async function sendWhatsApp({ to, firstName, message, communityName }) {
  const number = normalizeWhatsAppNumber(to);
  if (!number) return { ok: false, error: "WhatsApp number missing a country code." };
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: number,
        type: "template",
        template: {
          name: WHATSAPP_TEMPLATE_NAME,
          language: { code: WHATSAPP_TEMPLATE_LANG },
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: firstName },
                { type: "text", text: message },
                { type: "text", text: communityName },
              ],
            },
          ],
        },
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `${res.status}: ${body}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e?.message ?? "Unknown error sending WhatsApp message." };
  }
}

async function main() {
  const now = new Date();
  const month = now.getUTCMonth() + 1; // 1-12
  const day = now.getUTCDate();
  const year = now.getUTCFullYear();
  const monthName = MONTHS[month - 1];

  const rows = await sql`
    SELECT m.id, m.name, m.email, m.whatsapp, c.id AS community_id, c.name AS community_name, c.birthday_messages
    FROM public.members m
    JOIN public.communities c ON c.id = m.community_id
    WHERE m.status = 'active'
      AND (m.email IS NOT NULL OR m.whatsapp IS NOT NULL)
      AND m.dob IS NOT NULL
      AND EXTRACT(MONTH FROM m.dob) = ${month}
      AND EXTRACT(DAY FROM m.dob) = ${day}
      AND (m.last_birthday_sent_year IS NULL OR m.last_birthday_sent_year <> ${year})
  `;

  console.log(`[birthdays] ${now.toISOString()} — ${rows.length} celebrant(s) found for ${monthName} ${day}.`);

  let emailSent = 0;
  let emailFailed = 0;
  let waSent = 0;
  let waFailed = 0;

  // Grouped alongside the per-member sends below (same `rows`, so the digest
  // always matches exactly who was messaged this run) — collected here, sent
  // after the per-member loop finishes.
  const celebrantsByCommunity = new Map();

  for (const m of rows) {
    const message = m.birthday_messages?.[monthName] ?? "Happy birthday! 🎉";
    const firstName = String(m.name).split(" ")[0];
    let anyOk = false;

    const entry = celebrantsByCommunity.get(m.community_id) ?? { communityName: m.community_name, celebrants: [] };
    entry.celebrants.push({ name: m.name, message: `Happy birthday, ${firstName}! ${message}` });
    celebrantsByCommunity.set(m.community_id, entry);

    if (m.email) {
      const result = await sendEmail({
        to: m.email,
        subject: `Happy birthday, ${firstName}! 🎂`,
        fromName: m.community_name,
        html: birthdayEmail({ memberName: m.name, communityName: m.community_name, message }),
      });
      if (result.ok) {
        emailSent++;
        anyOk = true;
      } else {
        emailFailed++;
        console.error(`[birthdays] Failed to email ${m.email}: ${result.error}`);
      }
    }

    if (WHATSAPP_CONFIGURED && m.whatsapp) {
      const result = await sendWhatsApp({ to: m.whatsapp, firstName, message, communityName: m.community_name });
      if (result.ok) {
        waSent++;
        anyOk = true;
      } else {
        waFailed++;
        console.error(`[birthdays] Failed to WhatsApp ${m.whatsapp}: ${result.error}`);
      }
    }

    if (anyOk) {
      await sql`UPDATE public.members SET last_birthday_sent_year = ${year}, last_birthday_sent_at = now() WHERE id = ${m.id}::uuid`;
    }
  }

  // One digest per community (only communities with a celebrant today end up
  // in the map), to every community_admin on file — not just one, so a
  // community with co-admins doesn't leave anyone out of the loop.
  let digestSent = 0;
  let digestFailed = 0;
  if (celebrantsByCommunity.size > 0) {
    const adminRows = await sql`
      SELECT ur.community_id, u.email
      FROM public.user_roles ur
      JOIN public.users u ON u.id = ur.user_id
      WHERE ur.role = 'community_admin' AND ur.community_id = ANY(${Array.from(celebrantsByCommunity.keys())}::uuid[])
        AND u.email IS NOT NULL
    `;
    const adminsByCommunity = new Map();
    for (const a of adminRows) {
      const list = adminsByCommunity.get(a.community_id) ?? [];
      list.push(a.email);
      adminsByCommunity.set(a.community_id, list);
    }

    for (const [communityId, entry] of celebrantsByCommunity) {
      const adminEmails = Array.from(new Set(adminsByCommunity.get(communityId) ?? []));
      if (adminEmails.length === 0) {
        console.log(`[birthdays] No admin on file for ${entry.communityName} — skipping celebrants digest.`);
        continue;
      }
      const count = entry.celebrants.length;
      const subject = count === 1 ? `🎂 1 birthday today at ${entry.communityName}` : `🎂 ${count} birthdays today at ${entry.communityName}`;
      const html = celebrantsDigestEmail({ communityName: entry.communityName, celebrants: entry.celebrants });
      for (const adminEmail of adminEmails) {
        const result = await sendEmail({ to: adminEmail, subject, fromName: entry.communityName, html });
        if (result.ok) {
          digestSent++;
        } else {
          digestFailed++;
          console.error(`[birthdays] Failed to send celebrants digest to ${adminEmail}: ${result.error}`);
        }
      }
    }
  }

  console.log(
    `[birthdays] Done. Email sent ${emailSent}, failed ${emailFailed}.` +
      (WHATSAPP_CONFIGURED ? ` WhatsApp sent ${waSent}, failed ${waFailed}.` : "") +
      ` Admin digests sent ${digestSent}, failed ${digestFailed}.`,
  );
  if (emailSent === 0 && waSent === 0 && digestSent === 0 && (emailFailed > 0 || waFailed > 0 || digestFailed > 0)) process.exit(1);
}

main().catch((err) => {
  console.error("[birthdays] Fatal error:", err);
  process.exit(1);
});
