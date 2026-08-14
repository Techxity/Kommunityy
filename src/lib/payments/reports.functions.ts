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

    const commRows = await sql`SELECT expenses_reduce_held FROM public.communities WHERE id = ${communityId}::uuid LIMIT 1`;
    const reduceHeld = !!commRows[0]?.expenses_reduce_held;

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
    // Lifetime expenses per currency (all-time, not range) — used to reduce the
    // held figure when the admin has opted in.
    const lifetimeExpenses = await sql`
      SELECT currency, COALESCE(SUM(amount), 0) AS total
      FROM public.community_expenses WHERE community_id = ${communityId}::uuid
      GROUP BY currency
    `;
    const heldMap = new Map<Currency, { currency: Currency; net: number; paidOut: number; pending: number; expenses: number; held: number }>();
    const ensureHeld = (c: Currency) => {
      let e = heldMap.get(c);
      if (!e) { e = { currency: c, net: 0, paidOut: 0, pending: 0, expenses: 0, held: 0 }; heldMap.set(c, e); }
      return e;
    };
    for (const r of lifetimeNet) ensureHeld(r.currency as Currency).net += n(r.net);
    for (const r of payoutRows) {
      const e = ensureHeld(r.currency as Currency);
      e.paidOut += n(r.paid_out); e.pending += n(r.pending);
    }
    for (const r of lifetimeExpenses) ensureHeld(r.currency as Currency).expenses += n(r.total);
    for (const e of heldMap.values()) {
      e.held = Math.max(0, e.net - e.paidOut - (reduceHeld ? e.expenses : 0));
    }

    // Expenses in range, per currency + by category.
    const expenseRows = await sql`
      SELECT currency, category, COALESCE(SUM(amount), 0) AS total
      FROM public.community_expenses
      WHERE community_id = ${communityId}::uuid
        AND (${from}::date IS NULL OR spent_at >= ${from}::date)
        AND (${to}::date IS NULL OR spent_at <= ${to}::date)
      GROUP BY currency, category
    `;
    const expenseMap = new Map<Currency, { currency: Currency; total: number; byCategory: { category: string; amount: number }[] }>();
    for (const r of expenseRows) {
      const cur = r.currency as Currency;
      let e = expenseMap.get(cur);
      if (!e) { e = { currency: cur, total: 0, byCategory: [] }; expenseMap.set(cur, e); }
      const amt = n(r.total);
      e.total += amt;
      e.byCategory.push({ category: (r.category as string) || "General", amount: amt });
    }
    for (const e of expenseMap.values()) e.byCategory.sort((a, b) => b.amount - a.amount);

    // Net position for the period = income (net of fees) − expenses, per currency.
    const netCurrencies = new Set<Currency>([...byCurrency.keys(), ...expenseMap.keys()]);
    const netPosition = Array.from(netCurrencies).map((cur) => {
      const incomeNet = byCurrency.get(cur)?.net ?? 0;
      const expenses = expenseMap.get(cur)?.total ?? 0;
      return { currency: cur, incomeNet, expenses, net: incomeNet - expenses };
    }).sort((a, b) => (a.currency === "NGN" ? -1 : 1));

    return {
      range: { from, to },
      expensePolicy: { reduceHeld },
      summary: Array.from(byCurrency.values()).sort((a, b) => (a.currency === "NGN" ? -1 : 1)),
      expenses: Array.from(expenseMap.values()).sort((a, b) => (a.currency === "NGN" ? -1 : 1)),
      netPosition,
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
        UNION ALL
        -- Expenses as outflows: net is negative so the Net column sums to the
        -- true period surplus/deficit.
        SELECT (e.spent_at)::timestamptz AS paid_at, 'Expense' AS kind, e.category AS name, '' AS email,
               e.currency, e.amount AS gross, 0 AS fee, (-e.amount) AS net, COALESCE(e.description, '') AS reference
        FROM public.community_expenses e
        WHERE e.community_id = ${communityId}::uuid
          AND (${from}::date IS NULL OR e.spent_at >= ${from}::date)
          AND (${to}::date IS NULL OR e.spent_at <= ${to}::date)
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

// ── Expense entries (admin-managed) ─────────────────────────────────────

const EXPENSE_CATEGORIES = [
  "Maintenance", "Utilities", "Events", "Stipends/Salaries", "Rent",
  "Bank charges", "Security", "Supplies", "Transport", "General",
] as const;
export const EXPENSE_CATEGORY_LIST = EXPENSE_CATEGORIES;

export const listExpenses = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((i) => dateRange.parse(i))
  .handler(async ({ data, context }) => {
    const communityId = await communityIdForAdmin(context.userId, context.activeCommunityId);
    if (!communityId) return [];
    const from = data.from ?? null;
    const to = data.to ?? null;
    const rows = await sql`
      SELECT id, amount, currency, category, description, spent_at,
             (receipt_base64 IS NOT NULL) AS has_receipt, receipt_name
      FROM public.community_expenses
      WHERE community_id = ${communityId}::uuid
        AND (${from}::date IS NULL OR spent_at >= ${from}::date)
        AND (${to}::date IS NULL OR spent_at <= ${to}::date)
      ORDER BY spent_at DESC, created_at DESC
    `;
    return rows.map((r) => ({
      id: r.id as string,
      amount: n(r.amount),
      currency: r.currency as Currency,
      category: r.category as string,
      description: (r.description as string | null) ?? "",
      spentAt: new Date(r.spent_at as string).toISOString().slice(0, 10),
      hasReceipt: !!r.has_receipt,
      receiptName: (r.receipt_name as string | null) ?? null,
    }));
  });

const expenseInput = z.object({
  amount: z.number().positive().max(1_000_000_000),
  currency: z.enum(["NGN", "USD"]),
  category: z.string().min(1).max(60),
  description: z.string().max(300).optional().nullable(),
  spentAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const addExpense = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((i) => expenseInput.parse(i))
  .handler(async ({ data, context }) => {
    const communityId = await communityIdForAdmin(context.userId, context.activeCommunityId);
    if (!communityId) throw new Error("You don't manage a community yet.");
    await sql`
      INSERT INTO public.community_expenses (community_id, amount, currency, category, description, spent_at, created_by)
      VALUES (${communityId}::uuid, ${data.amount}, ${data.currency}, ${data.category}, ${data.description ?? null}, ${data.spentAt}::date, ${context.userId}::uuid)
    `;
    return { ok: true };
  });

export const updateExpense = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((i) => expenseInput.extend({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const communityId = await communityIdForAdmin(context.userId, context.activeCommunityId);
    if (!communityId) throw new Error("You don't manage a community yet.");
    await sql`
      UPDATE public.community_expenses
      SET amount = ${data.amount}, currency = ${data.currency}, category = ${data.category},
          description = ${data.description ?? null}, spent_at = ${data.spentAt}::date, updated_at = now()
      WHERE id = ${data.id}::uuid AND community_id = ${communityId}::uuid
    `;
    return { ok: true };
  });

export const deleteExpense = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const communityId = await communityIdForAdmin(context.userId, context.activeCommunityId);
    if (!communityId) throw new Error("You don't manage a community yet.");
    await sql`DELETE FROM public.community_expenses WHERE id = ${data.id}::uuid AND community_id = ${communityId}::uuid`;
    return { ok: true };
  });

// ── Expense receipts (optional evidence, stored inline as base64) ────────

const RECEIPT_MIMES = ["image/png", "image/jpeg", "image/webp", "application/pdf"] as const;
// ~3.3MB raw ≈ 4.5M base64 chars. Keeps rows sane and RPC payloads reasonable.
const MAX_RECEIPT_B64 = 4_500_000;

export const uploadExpenseReceipt = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((i) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().min(1).max(200),
        mime: z.enum(RECEIPT_MIMES),
        dataBase64: z.string().min(1).max(MAX_RECEIPT_B64),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const communityId = await communityIdForAdmin(context.userId, context.activeCommunityId);
    if (!communityId) throw new Error("You don't manage a community yet.");
    const res = await sql`
      UPDATE public.community_expenses
      SET receipt_base64 = ${data.dataBase64}, receipt_mime = ${data.mime}, receipt_name = ${data.name}, updated_at = now()
      WHERE id = ${data.id}::uuid AND community_id = ${communityId}::uuid
      RETURNING id
    `;
    if (res.length === 0) throw new Error("Expense not found.");
    return { ok: true };
  });

export const removeExpenseReceipt = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const communityId = await communityIdForAdmin(context.userId, context.activeCommunityId);
    if (!communityId) throw new Error("You don't manage a community yet.");
    await sql`
      UPDATE public.community_expenses
      SET receipt_base64 = NULL, receipt_mime = NULL, receipt_name = NULL, updated_at = now()
      WHERE id = ${data.id}::uuid AND community_id = ${communityId}::uuid
    `;
    return { ok: true };
  });

// Returns the receipt for inline viewing/download (admin-scoped).
export const getExpenseReceipt = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const communityId = await communityIdForAdmin(context.userId, context.activeCommunityId);
    if (!communityId) return null;
    const rows = await sql`
      SELECT receipt_base64, receipt_mime, receipt_name
      FROM public.community_expenses
      WHERE id = ${data.id}::uuid AND community_id = ${communityId}::uuid AND receipt_base64 IS NOT NULL
      LIMIT 1
    `;
    const r = rows[0];
    if (!r) return null;
    return { name: (r.receipt_name as string | null) ?? "receipt", mime: r.receipt_mime as string, dataBase64: r.receipt_base64 as string };
  });

// ── Expense policy: do expenses reduce the all-time funds position? ──────

export const setExpensePolicy = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((i) => z.object({ reduceHeld: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    const communityId = await communityIdForAdmin(context.userId, context.activeCommunityId);
    if (!communityId) throw new Error("You don't manage a community yet.");
    await sql`UPDATE public.communities SET expenses_reduce_held = ${data.reduceHeld}, updated_at = now() WHERE id = ${communityId}::uuid`;
    return { ok: true };
  });
