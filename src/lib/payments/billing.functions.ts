import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { sql } from "@/lib/db/client";
import { requireAuth } from "@/lib/auth/require-auth.server";
import { assertSuperAdmin } from "./authz";

// Platform revenue comes exclusively from public.plan_payments — one row per
// successful Paystack charge when a community pays for a tier (see the
// "plan" branch of the webhook at src/routes/api/public/paystack-webhook.ts).
// There is no recurring-billing engine yet (no next-charge date, no
// invoices) — a community pays once when it switches to a paid tier — so
// "revenue" here means "money actually collected," not projected MRR/ARR,
// which would be fabricated given how billing actually works today.

const PERIOD = z.enum(["week", "month", "year"]);
type Period = z.infer<typeof PERIOD>;

const BUCKET_COUNT: Record<Period, number> = { week: 12, month: 12, year: 6 };

function windowStart(period: Period, count: number): Date {
  const now = new Date();
  if (period === "year") return new Date(Date.UTC(now.getUTCFullYear() - count + 1, 0, 1));
  if (period === "month") return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - count + 1, 1));
  // week: back up to the Monday `count` weeks ago
  const day = now.getUTCDay();
  const mondayThisWeek = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - ((day + 6) % 7)));
  mondayThisWeek.setUTCDate(mondayThisWeek.getUTCDate() - 7 * (count - 1));
  return mondayThisWeek;
}

function bucketFor(period: Period, d: Date): { key: string; label: string; sortAt: number } {
  if (period === "year") {
    const y = d.getUTCFullYear();
    return { key: String(y), label: String(y), sortAt: Date.UTC(y, 0, 1) };
  }
  if (period === "month") {
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth();
    return {
      key: `${y}-${m}`,
      label: new Date(Date.UTC(y, m, 1)).toLocaleDateString(undefined, { month: "short", year: "numeric" }),
      sortAt: Date.UTC(y, m, 1),
    };
  }
  const day = d.getUTCDay();
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - ((day + 6) % 7)));
  return {
    key: monday.toISOString().slice(0, 10),
    label: monday.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    sortAt: monday.getTime(),
  };
}

// Revenue trend (bucketed collections) + a per-community payer table, both
// driven by a single period granularity (week/month/year) picked in the UI.
export const getBillingOverview = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((i) => z.object({ period: PERIOD.default("month") }).parse(i))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const period = data.period as Period;
    const count = BUCKET_COUNT[period];
    const start = windowStart(period, count);

    const payments = await sql`
      SELECT amount, currency, paid_at
      FROM public.plan_payments
      WHERE status = 'paid' AND paid_at >= ${start.toISOString()}::timestamptz
      ORDER BY paid_at ASC
    `;

    // Zero-fill every bucket first so the chart never has gaps for periods
    // with no payments.
    const buckets = new Map<string, { key: string; label: string; sortAt: number; ngn: number; usd: number }>();
    const cursor = new Date(start);
    for (let i = 0; i < count; i++) {
      const b = bucketFor(period, cursor);
      buckets.set(b.key, { ...b, ngn: 0, usd: 0 });
      if (period === "year") cursor.setUTCFullYear(cursor.getUTCFullYear() + 1);
      else if (period === "month") cursor.setUTCMonth(cursor.getUTCMonth() + 1);
      else cursor.setUTCDate(cursor.getUTCDate() + 7);
    }

    for (const p of payments) {
      const b = bucketFor(period, new Date(p.paid_at as string));
      const bucket = buckets.get(b.key);
      if (!bucket) continue; // outside the window edge case, ignore
      const amt = Number(p.amount);
      if (p.currency === "NGN") bucket.ngn += amt;
      else bucket.usd += amt;
    }

    const trend = Array.from(buckets.values()).sort((a, b) => a.sortAt - b.sortAt);
    const current = trend[trend.length - 1] ?? { ngn: 0, usd: 0 };

    const allTimeRows = await sql`
      SELECT
        COALESCE(SUM(amount) FILTER (WHERE currency = 'NGN'), 0) AS total_ngn,
        COALESCE(SUM(amount) FILTER (WHERE currency = 'USD'), 0) AS total_usd
      FROM public.plan_payments
      WHERE status = 'paid'
    `;

    // Communities + their tier, joined against payment history so we can
    // tell who's actually paying vs. who's on trial, free, or (an anomaly
    // worth surfacing) assigned a paid tier with no payment on record.
    const communityRows = await sql`
      SELECT
        c.id, c.name, c.trial_ends_at, c.suspended,
        t.name AS tier_name, t.monthly_price_ngn, t.monthly_price_usd
      FROM public.communities c
      LEFT JOIN public.subscription_tiers t ON t.id = c.tier_id
      ORDER BY c.created_at DESC
    `;

    const paymentAgg = await sql`
      SELECT community_id,
        COALESCE(SUM(amount) FILTER (WHERE currency = 'NGN'), 0) AS total_ngn,
        COALESCE(SUM(amount) FILTER (WHERE currency = 'USD'), 0) AS total_usd
      FROM public.plan_payments
      WHERE status = 'paid'
      GROUP BY community_id
    `;
    const totalsByCommunity = new Map(
      paymentAgg.map((r) => [r.community_id as string, { ngn: Number(r.total_ngn), usd: Number(r.total_usd) }]),
    );

    const lastPaymentRows = await sql`
      SELECT DISTINCT ON (community_id) community_id, amount, currency, paid_at
      FROM public.plan_payments
      WHERE status = 'paid'
      ORDER BY community_id, paid_at DESC
    `;
    const lastPaymentByCommunity = new Map(
      lastPaymentRows.map((r) => [
        r.community_id as string,
        { amount: Number(r.amount), currency: r.currency as "NGN" | "USD", paidAt: r.paid_at as string },
      ]),
    );

    const communities = communityRows.map((r) => {
      const id = r.id as string;
      const suspended = r.suspended as boolean;
      const trialEndsAt = r.trial_ends_at as string | null;
      const onTrial = !suspended && !!trialEndsAt && new Date(trialEndsAt).getTime() > Date.now();
      const priceNgn = r.monthly_price_ngn != null ? Number(r.monthly_price_ngn) : 0;
      const priceUsd = r.monthly_price_usd != null ? Number(r.monthly_price_usd) : 0;
      const isFree = priceNgn === 0 && priceUsd === 0;
      const totals = totalsByCommunity.get(id) ?? { ngn: 0, usd: 0 };
      const hasPaid = totals.ngn > 0 || totals.usd > 0;
      const last = lastPaymentByCommunity.get(id) ?? null;

      let status: "paid" | "trial" | "free" | "unpaid" | "suspended";
      if (suspended) status = "suspended";
      else if (onTrial) status = "trial";
      else if (!r.tier_name) status = "unpaid"; // no plan at all
      else if (isFree) status = "free";
      else if (hasPaid) status = "paid";
      else status = "unpaid";

      return {
        id,
        name: r.name as string,
        tierName: (r.tier_name as string | null) ?? "No plan",
        priceNgn,
        priceUsd,
        status,
        trialDaysLeft: onTrial
          ? Math.max(0, Math.ceil((new Date(trialEndsAt as string).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
          : null,
        lastPaymentAt: last ? last.paidAt : null,
        lastPaymentAmount: last ? last.amount : null,
        lastPaymentCurrency: last ? last.currency : null,
        totalPaidNgn: totals.ngn,
        totalPaidUsd: totals.usd,
      };
    });

    return {
      period,
      trend: trend.map((b) => ({ label: b.label, ngn: b.ngn, usd: b.usd })),
      collectedThisPeriod: { ngn: current.ngn, usd: current.usd },
      collectedAllTime: {
        ngn: Number(allTimeRows[0]?.total_ngn ?? 0),
        usd: Number(allTimeRows[0]?.total_usd ?? 0),
      },
      payingCount: communities.filter((c) => c.status === "paid").length,
      notPayingCount: communities.filter((c) => c.status === "trial" || c.status === "unpaid").length,
      communities,
    };
  });
