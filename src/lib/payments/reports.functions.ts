// Treasurer's financial report: what the community collected (dues + donations)
// over a period, net of platform fees, plus the all-time funds position (net
// collected vs paid out = currently held). Scoped to the admin's community and
// split by currency, since a plan can price in ₦ and $. Read-only aggregation
// over dues_payments / donation_payments / payouts — never the platform's own
// subscription revenue (plan_payments) or the SMS wallet.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { sql } from "@/lib/db/client";
import { requireAuth } from "@/lib/auth/require-auth.server";
import { communityIdForAdmin } from "./communities.functions";

const dateRange = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

type Currency = "NGN" | "USD";
const n = (v: unknown) => Number(v ?? 0);

export const getFinancialReport = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((i) => dateRange.parse(i))
  .handler(async ({ data, context }) => {
    const communityId = await communityIdForAdmin(context.userId, context.activeCommunityId);
    if (!communityId) return null;
    const from = data.from ?? null;
    const to = data.to ?? null;

    // Category totals per currency, within the selected range.
    const dues = await sql`
      SELECT dp.currency,
             COALESCE(SUM(dp.amount), 0) AS gross,
             COALESCE(SUM(dp.platform_fee), 0) AS fees,
             COALESCE(SUM(dp.community_net), 0) AS net,
             COUNT(*) AS cnt
      FROM public.dues_payments dp
      JOIN public.dues_plans p ON p.id = dp.plan_id
      WHERE p.community_id = ${communityId}::uuid AND dp.status = 'paid'
        AND (${from}::date IS NULL OR dp.paid_at >= ${from}::date)
        AND (${to}::date IS NULL OR dp.paid_at < (${to}::date + INTERVAL '1 day'))
      GROUP BY dp.currency
    `;
    const donations = await sql`
      SELECT dp.currency,
             COALESCE(SUM(dp.amount), 0) AS gross,
             COALESCE(SUM(dp.platform_fee), 0) AS fees,
             COALESCE(SUM(dp.community_net), 0) AS net,
             COUNT(*) AS cnt
      FROM public.donation_payments dp
      JOIN public.donations d ON d.id = dp.donation_id
      WHERE d.community_id = ${communityId}::uuid AND dp.status = 'paid'
        AND (${from}::date IS NULL OR dp.paid_at >= ${from}::date)
        AND (${to}::date IS NULL OR dp.paid_at < (${to}::date + INTERVAL '1 day'))
      GROUP BY dp.currency
    `;

    // Assemble per-currency summary.
    const byCurrency = new Map<Currency, {
      currency: Currency; duesGross: number; duesNet: number; donationsGross: number; donationsNet: number;
      gross: number; fees: number; net: number; count: number;
    }>();
    const ensure = (c: Currency) => {
      let e = byCurrency.get(c);
      if (!e) { e = { currency: c, duesGross: 0, duesNet: 0, donationsGross: 0, donationsNet: 0, gross: 0, fees: 0, net: 0, count: 0 }; byCurrency.set(c, e); }
      return e;
    };
    for (const r of dues) {
      const e = ensure(r.currency as Currency);
      e.duesGross += n(r.gross); e.duesNet += n(r.net);
      e.gross += n(r.gross); e.fees += n(r.fees); e.net += n(r.net); e.count += n(r.cnt);
    }
    for (const r of donations) {
      const e = ensure(r.currency as Currency);
      e.donationsGross += n(r.gross); e.donationsNet += n(r.net);
      e.gross += n(r.gross); e.fees += n(r.fees); e.net += n(r.net); e.count += n(r.cnt);
    }

    // Monthly breakdown (dues vs donations gross) per currency.
    const monthlyRows = await sql`
      SELECT to_char(t.paid_at, 'YYYY-MM') AS month, t.currency, t.kind, COALESCE(SUM(t.amount), 0) AS gross
      FROM (
        SELECT dp.paid_at, dp.currency, 'dues' AS kind, dp.amount
        FROM public.dues_payments dp JOIN public.dues_plans p ON p.id = dp.plan_id
        WHERE p.community_id = ${communityId}::uuid AND dp.status = 'paid'
          AND (${from}::date IS NULL OR dp.paid_at >= ${from}::date)
          AND (${to}::date IS NULL OR dp.paid_at < (${to}::date + INTERVAL '1 day'))
        UNION ALL
        SELECT dp.paid_at, dp.currency, 'donation' AS kind, dp.amount
        FROM public.donation_payments dp JOIN public.donations d ON d.id = dp.donation_id
        WHERE d.community_id = ${communityId}::uuid AND dp.status = 'paid'
          AND (${from}::date IS NULL OR dp.paid_at >= ${from}::date)
          AND (${to}::date IS NULL OR dp.paid_at < (${to}::date + INTERVAL '1 day'))
      ) t
      GROUP BY month, t.currency, t.kind
      ORDER BY month
    `;
    const monthMap = new Map<string, { month: string; currency: Currency; dues: number; donations: number }>();
    for (const r of monthlyRows) {
      const key = `${r.month}|${r.currency}`;
      let e = monthMap.get(key);
      if (!e) { e = { month: r.month as string, currency: r.currency as Currency, dues: 0, donations: 0 }; monthMap.set(key, e); }
      if (r.kind === "dues") e.dues += n(r.gross); else e.donations += n(r.gross);
    }

    // Member dues contributions (range).
    const memberRows = await sql`
      SELECT COALESCE(NULLIF(MAX(dp.member_name), ''), '—') AS name,
             lower(COALESCE(dp.member_email, '')) AS email,
             dp.currency,
             COALESCE(SUM(dp.amount), 0) AS total,
             COALESCE(SUM(dp.months), 0) AS periods,
             COUNT(*) AS cnt,
             MAX(dp.paid_at) AS last_paid
      FROM public.dues_payments dp
      JOIN public.dues_plans p ON p.id = dp.plan_id
      WHERE p.community_id = ${communityId}::uuid AND dp.status = 'paid'
        AND (${from}::date IS NULL OR dp.paid_at >= ${from}::date)
        AND (${to}::date IS NULL OR dp.paid_at < (${to}::date + INTERVAL '1 day'))
      GROUP BY lower(COALESCE(dp.member_email, '')), dp.currency
      ORDER BY total DESC
      LIMIT 500
    `;

    // All-time funds position: lifetime net collected vs lifetime paid out.
    const lifetimeNet = await sql`
      SELECT currency, COALESCE(SUM(net), 0) AS net FROM (
        SELECT dp.currency, dp.community_net AS net
        FROM public.dues_payments dp JOIN public.dues_plans p ON p.id = dp.plan_id
        WHERE p.community_id = ${communityId}::uuid AND dp.status = 'paid'
        UNION ALL
        SELECT dp.currency, dp.community_net AS net
        FROM public.donation_payments dp JOIN public.donations d ON d.id = dp.donation_id
        WHERE d.community_id = ${communityId}::uuid AND dp.status = 'paid'
      ) t GROUP BY currency
    `;
    const payoutRows = await sql`
      SELECT currency,
             COALESCE(SUM(amount) FILTER (WHERE status = 'paid'), 0) AS paid_out,
             COALESCE(SUM(amount) FILTER (WHERE status IN ('requested', 'approved')), 0) AS pending
      FROM public.payouts
      WHERE community_id = ${communityId}::uuid
      GROUP BY currency
    `;
    const heldMap = new Map<Currency, { currency: Currency; net: number; paidOut: number; pending: number; held: number }>();
    const ensureHeld = (c: Currency) => {
      let e = heldMap.get(c);
      if (!e) { e = { currency: c, net: 0, paidOut: 0, pending: 0, held: 0 }; heldMap.set(c, e); }
      return e;
    };
    for (const r of lifetimeNet) ensureHeld(r.currency as Currency).net += n(r.net);
    for (const r of payoutRows) {
      const e = ensureHeld(r.currency as Currency);
      e.paidOut += n(r.paid_out); e.pending += n(r.pending);
    }
    for (const e of heldMap.values()) e.held = Math.max(0, e.net - e.paidOut);

    return {
      range: { from, to },
      summary: Array.from(byCurrency.values()).sort((a, b) => (a.currency === "NGN" ? -1 : 1)),
      monthly: Array.from(monthMap.values()).sort((a, b) => a.month.localeCompare(b.month) || (a.currency === "NGN" ? -1 : 1)),
      members: memberRows.map((r) => ({
        name: r.name as string,
        email: (r.email as string) || null,
        currency: r.currency as Currency,
        total: n(r.total),
        periods: n(r.periods),
        payments: n(r.cnt),
        lastPaid: r.last_paid ? new Date(r.last_paid as string).toLocaleDateString() : "—",
      })),
      held: Array.from(heldMap.values()).sort((a, b) => (a.currency === "NGN" ? -1 : 1)),
    };
  });

// Flat transaction ledger for CSV export (dues + donations) in the range.
export const exportFinancialTransactions = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((i) => dateRange.parse(i))
  .handler(async ({ data, context }) => {
    const communityId = await communityIdForAdmin(context.userId, context.activeCommunityId);
    if (!communityId) return [];
    const from = data.from ?? null;
    const to = data.to ?? null;

    const rows = await sql`
      SELECT paid_at, kind, name, email, currency, gross, fee, net, reference FROM (
        SELECT dp.paid_at, 'Dues' AS kind, dp.member_name AS name, dp.member_email AS email,
               dp.currency, dp.amount AS gross, dp.platform_fee AS fee, dp.community_net AS net, dp.provider_ref AS reference
        FROM public.dues_payments dp JOIN public.dues_plans p ON p.id = dp.plan_id
        WHERE p.community_id = ${communityId}::uuid AND dp.status = 'paid'
          AND (${from}::date IS NULL OR dp.paid_at >= ${from}::date)
          AND (${to}::date IS NULL OR dp.paid_at < (${to}::date + INTERVAL '1 day'))
        UNION ALL
        SELECT dp.paid_at, 'Donation' AS kind, dp.payer_name AS name, dp.payer_email AS email,
               dp.currency, dp.amount AS gross, dp.platform_fee AS fee, dp.community_net AS net, dp.provider_ref AS reference
        FROM public.donation_payments dp JOIN public.donations d ON d.id = dp.donation_id
        WHERE d.community_id = ${communityId}::uuid AND dp.status = 'paid'
          AND (${from}::date IS NULL OR dp.paid_at >= ${from}::date)
          AND (${to}::date IS NULL OR dp.paid_at < (${to}::date + INTERVAL '1 day'))
      ) t
      ORDER BY paid_at DESC
    `;
    return rows.map((r) => ({
      date: new Date(r.paid_at as string).toISOString().slice(0, 10),
      type: r.kind as string,
      name: (r.name as string | null) ?? "",
      email: (r.email as string | null) ?? "",
      currency: r.currency as Currency,
      gross: n(r.gross),
      fee: n(r.fee),
      net: n(r.net),
      reference: (r.reference as string | null) ?? "",
    }));
  });
