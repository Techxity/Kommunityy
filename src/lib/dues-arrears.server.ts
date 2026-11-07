// Server-side dues-arrears ledger for one community: joins active members
// against their paid dues periods and turns the gap into per-member arrears.
// Used by both the admin ledger (getDuesArrears) and the automated reminder
// cron (runDuesReminderJob), so the "who owes what" logic lives in exactly one
// place. The pure math is in ./dues-arrears; this file only does the DB reads.

import { sql } from "@/lib/db/client";
import { parseYm, currentYm } from "@/lib/dues-period";
import { toDateOnlyString } from "@/lib/date-only";
import {
  computeArrears,
  laterYm,
  mergePaidTotals,
  primaryCurrencyOf,
  resolveMemberDues,
  resolveMemberPrice,
  type DuesAmounts,
  type DuesPriceSource,
  type PaidTotals,
} from "@/lib/dues-arrears";

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
  unitAmount: number; // what this member pays per period, in `currency`
  priceSource: DuesPriceSource;
  rateName: string | null;
  duesPayToken: string;
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

const numOrNull = (v: unknown) => (v != null ? Number(v) : null);

// One member's price per period, for checkout and charge validation. Scoped to
// the community so a member id can only ever price that community's dues.
export async function loadMemberPrice(memberId: string, communityId: string, plan: DuesAmounts) {
  const rows = await sql`
    SELECT m.dues_custom_ngn, m.dues_custom_usd, r.amount_ngn AS rate_ngn, r.amount_usd AS rate_usd
    FROM public.members m
    LEFT JOIN public.dues_rates r ON r.id = m.dues_rate_id
    WHERE m.id = ${memberId}::uuid AND m.community_id = ${communityId}::uuid
    LIMIT 1
  `;
  const r = rows[0];
  if (!r) return resolveMemberPrice(plan, null, null);
  return resolveMemberPrice(
    plan,
    { amountNgn: numOrNull(r.rate_ngn), amountUsd: numOrNull(r.rate_usd) },
    { amountNgn: numOrNull(r.dues_custom_ngn), amountUsd: numOrNull(r.dues_custom_usd) },
  );
}

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
    SELECT m.id, m.name, m.email, m.phone, m.whatsapp, m.sms_opt_out,
           COALESCE(m.joined_at, m.created_at) AS since,
           m.last_dues_reminder_at, m.dues_pay_token, m.dues_custom_ngn, m.dues_custom_usd,
           r.name AS rate_name, r.amount_ngn AS rate_ngn, r.amount_usd AS rate_usd
    FROM public.members m
    LEFT JOIN public.dues_rates r ON r.id = m.dues_rate_id
    WHERE m.community_id = ${communityId}::uuid AND m.status = 'active'
    ORDER BY m.name ASC
  `;

  // Payments made or recorded since member_id existed are linked directly.
  // Older ones (and pay-link payments from an unrecognised email) only carry
  // member_email, so those are matched by lowercased email. A row with a
  // member_id never falls into the email bucket, so nothing counts twice.
  // last_currency = the currency of the member's most recent payment, so we
  // bill their arrears in the currency they actually use.
  const payRows = await sql`
    SELECT dp.member_id,
           CASE WHEN dp.member_id IS NULL THEN lower(dp.member_email) END AS email,
           COALESCE(SUM(dp.months), 0) AS paid_periods,
           MAX(dp.paid_at) AS last_paid,
           (ARRAY_AGG(dp.currency ORDER BY dp.paid_at DESC))[1] AS last_currency
    FROM public.dues_payments dp
    JOIN public.dues_plans p ON p.id = dp.plan_id
    WHERE p.community_id = ${communityId}::uuid
      AND dp.status = 'paid'
      AND (dp.member_id IS NOT NULL OR dp.member_email IS NOT NULL)
    GROUP BY dp.member_id, CASE WHEN dp.member_id IS NULL THEN lower(dp.member_email) END
  `;
  const paidById = new Map<string, PaidTotals>();
  const paidByEmail = new Map<string, PaidTotals>();
  for (const r of payRows) {
    const totals: PaidTotals = {
      paidPeriods: Number(r.paid_periods ?? 0),
      lastPaid: r.last_paid ? new Date(r.last_paid as string).toISOString() : null,
      lastCurrency: (r.last_currency as "NGN" | "USD" | null) ?? null,
    };
    if (r.member_id) paidById.set(r.member_id as string, totals);
    else paidByEmail.set(r.email as string, totals);
  }

  const members: ArrearsMemberRow[] = memberRows.map((m) => {
    const email = (m.email as string | null) ?? null;
    const paid = mergePaidTotals(paidById.get(m.id as string), email ? paidByEmail.get(email.toLowerCase()) : undefined);
    const joinedYm = parseYm(toDateOnlyString(m.since));
    const startYm = laterYm(planStartYm, joinedYm);
    const price = resolveMemberPrice(
      { amountNgn, amountUsd },
      { amountNgn: numOrNull(m.rate_ngn), amountUsd: numOrNull(m.rate_usd) },
      { amountNgn: numOrNull(m.dues_custom_ngn), amountUsd: numOrNull(m.dues_custom_usd) },
    );
    const { currency, unitAmount } = resolveMemberDues(paid?.lastCurrency, price.amountNgn, price.amountUsd, primaryCurrencyOf(price));
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
      unitAmount,
      priceSource: price.source,
      rateName: (m.rate_name as string | null) ?? null,
      duesPayToken: m.dues_pay_token as string,
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
