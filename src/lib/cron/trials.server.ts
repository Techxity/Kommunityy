// The daily trial-lifecycle job (warn at 2 days and 1 day left, suspend at 0),
// as an importable server function for the Vercel Cron route handler
// (src/routes/api/cron/trials.ts). Mirrors scripts/trial-lifecycle.mjs — keep
// the two in sync.
import { sql } from "@/lib/db/client";
import { sendEmail } from "@/lib/email";
import { trialReminderEmail, trialEndedEmail } from "@/lib/email-templates";

export type TrialJobResult = {
  checked: number;
  warned2: number;
  warned1: number;
  suspended: number;
  failed: number;
};

// baseUrl powers the "Choose a plan" button in the emails. Pass the request
// origin (or APP_URL); an empty string just omits the CTA rather than emailing
// a broken link.
export async function runTrialLifecycleJob(baseUrl: string): Promise<TrialJobResult> {
  const now = new Date();
  const appUrl = baseUrl.replace(/\/+$/, "");
  const subscriptionUrl = appUrl ? `${appUrl}/admin/subscription` : "";

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

  let warned2 = 0;
  let warned1 = 0;
  let suspended = 0;
  let failed = 0;
  const msPerDay = 24 * 60 * 60 * 1000;

  for (const c of rows) {
    const adminEmail = c.admin_email as string | null;
    if (!adminEmail) continue;
    const adminName = (c.admin_name as string | null) || "there";
    const communityName = c.name as string;
    const daysLeft = Math.ceil((new Date(c.trial_ends_at as string).getTime() - now.getTime()) / msPerDay);

    if (daysLeft <= 0) {
      const r = await sendEmail({
        to: adminEmail,
        subject: `${communityName}'s trial has ended`,
        html: trialEndedEmail({ adminName, communityName, subscriptionUrl }),
      });
      if (r.ok) {
        await sql`UPDATE public.communities SET suspended = true, updated_at = now() WHERE id = ${c.id}::uuid`;
        suspended++;
      } else {
        failed++;
      }
    } else if (daysLeft === 1 && !c.trial_warned_1_at) {
      const r = await sendEmail({
        to: adminEmail,
        subject: `${communityName}'s trial ends tomorrow`,
        html: trialReminderEmail({ adminName, communityName, daysLeft: 1, subscriptionUrl }),
      });
      if (r.ok) {
        await sql`UPDATE public.communities SET trial_warned_1_at = now() WHERE id = ${c.id}::uuid`;
        warned1++;
      } else {
        failed++;
      }
    } else if (daysLeft === 2 && !c.trial_warned_2_at) {
      const r = await sendEmail({
        to: adminEmail,
        subject: `${communityName}'s trial ends in 2 days`,
        html: trialReminderEmail({ adminName, communityName, daysLeft: 2, subscriptionUrl }),
      });
      if (r.ok) {
        await sql`UPDATE public.communities SET trial_warned_2_at = now() WHERE id = ${c.id}::uuid`;
        warned2++;
      } else {
        failed++;
      }
    }
  }

  return { checked: rows.length, warned2, warned1, suspended, failed };
}
