// Automated dues-arrears reminders. For every active (non-suspended) community
// with a dues plan, emails each member who is behind — but only if they haven't
// already been reminded within the cooldown window. That self-throttling is
// what lets this run on the same daily schedule as the other crons without
// spamming: a defaulter gets at most one reminder per REMIND_COOLDOWN_DAYS, and
// a newly-behind member is caught on the next daily run. Reuses the exact same
// arrears math and email as the manual admin "Send reminders" button.
import { sql } from "@/lib/db/client";
import { sendEmailsBatch } from "@/lib/email";
import { duesReminderEmail } from "@/lib/email-templates";
import { periodUnit } from "@/lib/dues-period";
import { computeCommunityArrears } from "@/lib/dues-arrears.server";

// Don't re-remind the same member more often than this. ~25 days means a
// monthly-dues member is nudged roughly once per cycle, never twice.
export const REMIND_COOLDOWN_DAYS = 25;

export type DuesReminderJobResult = {
  communities: number;
  sent: number;
  failed: number;
};

export async function runDuesReminderJob(baseUrl: string): Promise<DuesReminderJobResult> {
  const appUrl = baseUrl.replace(/\/+$/, "");
  const cutoffMs = Date.now() - REMIND_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

  // Only communities that are live and actually have a dues plan.
  const communities = await sql`
    SELECT DISTINCT c.id, c.name
    FROM public.communities c
    JOIN public.dues_plans dp ON dp.community_id = c.id AND dp.active = true
    WHERE c.suspended = false
  `;

  let totalSent = 0;
  let totalFailed = 0;

  for (const c of communities) {
    const communityId = c.id as string;
    const communityName = (c.name as string) || "your community";

    const { plan, members } = await computeCommunityArrears(communityId);
    if (!plan) continue;

    const payUrl = appUrl ? `${appUrl}/pay-dues/${plan.id}` : undefined;
    const periodWord = periodUnit(plan.interval);

    const targets = members.filter((m) => {
      if (m.periodsBehind <= 0 || !m.email) return false;
      if (m.lastRemindedAt && new Date(m.lastRemindedAt).getTime() > cutoffMs) return false;
      return true;
    });
    if (targets.length === 0) continue;

    const messages = targets.map((m) => ({
      to: m.email as string,
      id: m.memberId,
      subject: `Dues reminder — ${communityName}`,
      fromName: communityName,
      html: duesReminderEmail({
        memberName: m.name,
        communityName,
        amountLabel: `${plan.currency === "NGN" ? "₦" : "$"}${Math.round(m.amountOwed).toLocaleString()}`,
        periodsBehind: m.periodsBehind,
        periodWord,
        payUrl,
      }),
    }));

    const { sent, failed, okIds } = await sendEmailsBatch(messages);
    totalSent += sent;
    totalFailed += failed;
    if (okIds.length > 0) {
      await sql`UPDATE public.members SET last_dues_reminder_at = now() WHERE id = ANY(${okIds}::uuid[])`;
    }
  }

  return { communities: communities.length, sent: totalSent, failed: totalFailed };
}
