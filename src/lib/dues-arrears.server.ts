// Server-side dues-arrears ledger for one community: joins active members
// against their paid dues periods and turns the gap into per-member arrears.
// Used by both the admin ledger (getDuesArrears) and the automated reminder
// cron (runDuesReminderJob), so the "who owes what" logic lives in exactly one
// place. The pure math is in ./dues-arrears; this file only does the DB reads.

import { sql } from "@/lib/db/client";
import { parseYm, currentYm } from "@/lib/dues-period";
import { toDateOnlyString } from "@/lib/date-only";
import { computeArrears, laterYm, resolveMemberDues } from "@/lib/dues-arrears";

export type ArrearsMemberRow = {
  memberId: string;
  name: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  smsOptOut: boolean;
  currency: "NGN" | "USD"; // the currency this member is billed/owes in
  expectedPeriods: number;
  paidPeriods: number;
  periodsBehind: number;
  amountOwed: number;
  lastPaidAt: string | null; // ISO instant, or null if they've never paid
  lastRemindedAt: string | null; // ISO instant, or null if never reminded
};

export type CommunityArrears = {
  plan: {
    id: string;
    name: string;
    interval: string;
    amountNgn: number | null;
    amountUsd: number | null;
    primaryCurrency: "NGN" | "USD";
  } | null;
  members: ArrearsMemberRow[]; // all active members, defaulters first
};

// Computes arrears for every active member of a community. Returns plan: null
// (and no members) when the community has no active dues plan — there's nothing
// to be in arrears of.
export async function computeCommunityArrears(communityId: string): Promise<CommunityArrears> {
  const planRows = await sql`
    SELECT id, name, interval, amount_ngn, amount_usd, created_at
    FROM public.dues_plans
    WHERE community_id = ${communityId}::uuid AND active = true
    ORDER BY created_at DESC
    LIMIT 1
  `;
  const planRow = planRows[0];
  if (!planRow) return { plan: null, members: [] };

  const amountNgn = planRow.amount_ngn != null ? Number(planRow.amount_ngn) : null;
  const amountUsd = planRow.amount_usd != null ? Number(planRow.amount_usd) : null;
  // A plan can price in NGN, USD, or both. Each member owes in the currency
  // they actually pay in; the primary (NGN if set, else USD) is only the
  // fallback for members who've never paid.
  const primaryCurrency: "NGN" | "USD" = amountNgn != null ? "NGN" : "USD";
  const interval = planRow.interval as string;
  const planStartYm = parseYm(toDateOnlyString(planRow.created_at));
  const nowYm = currentYm();

  const memberRows = await sql`
    SELECT id, name, email, phone, whatsapp, sms_opt_out,
           COALESCE(joined_at, created_at) AS since,
           last_dues_reminder_at
    FROM public.members
    WHERE community_id = ${communityId}::uuid AND status = 'active'
    ORDER BY name ASC
  `;

  // Dues payments key by member_email (the pay link is public and collects an
  // email, not a member id), so paid periods are aggregated by lowercased
  // email and matched back to members. A member with no email on file can't be
  // matched — they show as 0 paid and are flagged in the UI as "no email".
  // last_currency = the currency of the member's most recent payment, so we
  // bill their arrears in the currency they actually use.
  const payRows = await sql`
    SELECT lower(dp.member_email) AS email,
           COALESCE(SUM(dp.months), 0) AS paid_periods,
           MAX(dp.paid_at) AS last_paid,
           (ARRAY_AGG(dp.currency ORDER BY dp.paid_at DESC))[1] AS last_currency
    FROM public.dues_payments dp
    JOIN public.dues_plans p ON p.id = dp.plan_id
    WHERE p.community_id = ${communityId}::uuid
      AND dp.status = 'paid'
      AND dp.member_email IS NOT NULL
    GROUP BY lower(dp.member_email)
  `;
  const paidByEmail = new Map<
    string,
    { paidPeriods: number; lastPaid: string | null; lastCurrency: "NGN" | "USD" | null }
  >();
  for (const r of payRows) {
    paidByEmail.set(r.email as string, {
      paidPeriods: Number(r.paid_periods ?? 0),
      lastPaid: r.last_paid ? new Date(r.last_paid as string).toISOString() : null,
      lastCurrency: (r.last_currency as "NGN" | "USD" | null) ?? null,
    });
  }

  const members: ArrearsMemberRow[] = memberRows.map((m) => {
    const email = (m.email as string | null) ?? null;
    const paid = email ? paidByEmail.get(email.toLowerCase()) : undefined;
    const joinedYm = parseYm(toDateOnlyString(m.since));
    const startYm = laterYm(planStartYm, joinedYm);
    const { currency, unitAmount } = resolveMemberDues(paid?.lastCurrency, amountNgn, amountUsd, primaryCurrency);
    const a = computeArrears({ startYm, nowYm, interval, paidPeriods: paid?.paidPeriods ?? 0, unitAmount });
    return {
      memberId: m.id as string,
      name: m.name as string,
      email,
      phone: (m.phone as string | null) ?? null,
      whatsapp: (m.whatsapp as string | null) ?? null,
      smsOptOut: !!m.sms_opt_out,
      currency,
      expectedPeriods: a.expectedPeriods,
      paidPeriods: a.paidPeriods,
      periodsBehind: a.arrearsPeriods,
      amountOwed: a.amountOwed,
      lastPaidAt: paid?.lastPaid ?? null,
      lastRemindedAt: m.last_dues_reminder_at
        ? new Date(m.last_dues_reminder_at as string).toISOString()
        : null,
    };
  });

  // Most-behind first so the defaulters surface at the top.
  members.sort((a, b) => b.amountOwed - a.amountOwed || b.periodsBehind - a.periodsBehind || a.name.localeCompare(b.name));

  return {
    plan: {
      id: planRow.id as string,
      name: planRow.name as string,
      interval,
      amountNgn,
      amountUsd,
      primaryCurrency,
    },
    members,
  };
}
