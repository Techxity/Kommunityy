#!/usr/bin/env node
// Standalone daily job: warns trial communities at 2 days and 1 day left,
// then suspends them once the trial hits 0. Talks to Neon and Resend
// directly — no dependency on the web app process, same pattern as
// scripts/send-birthday-emails.mjs. Run it once a day (see that file's
// header comment for how to schedule it on Railway or locally).
//
// Requires DATABASE_URL and RESEND_API_KEY in the environment.
//   node --env-file=.env scripts/trial-lifecycle.mjs   (local)
//   node scripts/trial-lifecycle.mjs                    (Railway cron job)

import { neon } from "@neondatabase/serverless";
import { trialReminderEmail, trialEndedEmail } from "./lib/email-templates.mjs";

const DATABASE_URL = process.env.DATABASE_URL;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM_ADDRESS =
  process.env.RESEND_FROM_ADDRESS ||
  process.env.RESEND_FROM_EMAIL?.match(/<([^>]+)>/)?.[1] ||
  "onboarding@resend.dev";
// No request context out here (this runs as a standalone cron job, not an
// HTTP handler), so the link in trial emails needs an explicit base URL.
// Falls back to no CTA button — just the plain-text notice — if it's unset,
// rather than emailing a broken link.
const APP_URL = process.env.APP_URL?.replace(/\/+$/, "") || "";

if (!DATABASE_URL) {
  console.error("Missing DATABASE_URL — aborting.");
  process.exit(1);
}
if (!RESEND_API_KEY) {
  console.error("Missing RESEND_API_KEY — aborting.");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function sendEmail({ to, subject, html }) {
  const from = `Kommunity <${RESEND_FROM_ADDRESS}>`;
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

  const rows = await sql`
    SELECT c.id, c.name, c.trial_ends_at, c.trial_warned_2_at, c.trial_warned_1_at,
           admin.email AS admin_email, admin.name AS admin_name
    FROM public.communities c
    LEFT JOIN LATERAL (
      SELECT u.email, u.name
      FROM public.user_roles ur
      JOIN public.users u ON u.id = ur.user_id
      WHERE ur.community_id = c.id AND ur.role = 'community_admin'
      ORDER BY ur.created_at ASC
      LIMIT 1
    ) admin ON true
    WHERE c.trial_ends_at IS NOT NULL AND c.suspended = false
  `;

  console.log(`[trials] ${now.toISOString()} — checking ${rows.length} trial communit${rows.length === 1 ? "y" : "ies"}.`);

  let warned2 = 0, warned1 = 0, suspended = 0, failed = 0;

  for (const c of rows) {
    if (!c.admin_email) continue;
    const adminName = c.admin_name || "there";
    const msPerDay = 24 * 60 * 60 * 1000;
    const daysLeft = Math.ceil((new Date(c.trial_ends_at).getTime() - now.getTime()) / msPerDay);

    if (daysLeft <= 0) {
      const result = await sendEmail({
        to: c.admin_email,
        subject: `${c.name}'s trial has ended`,
        html: trialEndedEmail({
          adminName,
          communityName: c.name,
          subscriptionUrl: APP_URL ? `${APP_URL}/admin/subscription` : "",
        }),
      });
      if (result.ok) {
        await sql`UPDATE public.communities SET suspended = true, updated_at = now() WHERE id = ${c.id}::uuid`;
        suspended++;
      } else {
        failed++;
        console.error(`[trials] Failed to email ${c.admin_email} (suspend notice): ${result.error}`);
      }
    } else if (daysLeft === 1 && !c.trial_warned_1_at) {
      const result = await sendEmail({
        to: c.admin_email,
        subject: `${c.name}'s trial ends tomorrow`,
        html: trialReminderEmail({
          adminName,
          communityName: c.name,
          daysLeft: 1,
          subscriptionUrl: APP_URL ? `${APP_URL}/admin/subscription` : "",
        }),
      });
      if (result.ok) {
        await sql`UPDATE public.communities SET trial_warned_1_at = now() WHERE id = ${c.id}::uuid`;
        warned1++;
      } else {
        failed++;
        console.error(`[trials] Failed to email ${c.admin_email} (day-1 warning): ${result.error}`);
      }
    } else if (daysLeft === 2 && !c.trial_warned_2_at) {
      const result = await sendEmail({
        to: c.admin_email,
        subject: `${c.name}'s trial ends in 2 days`,
        html: trialReminderEmail({
          adminName,
          communityName: c.name,
          daysLeft: 2,
          subscriptionUrl: APP_URL ? `${APP_URL}/admin/subscription` : "",
        }),
      });
      if (result.ok) {
        await sql`UPDATE public.communities SET trial_warned_2_at = now() WHERE id = ${c.id}::uuid`;
        warned2++;
      } else {
        failed++;
        console.error(`[trials] Failed to email ${c.admin_email} (day-2 warning): ${result.error}`);
      }
    }
  }

  console.log(`[trials] Done. Warned (2d): ${warned2}, warned (1d): ${warned1}, suspended: ${suspended}, failed: ${failed}.`);
}

main().catch((err) => {
  console.error("[trials] Fatal error:", err);
  process.exit(1);
});
