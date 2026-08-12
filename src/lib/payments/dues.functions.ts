import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRequestHost } from "@tanstack/react-start/server";
import { sql } from "@/lib/db/client";
import { initializeTransaction, verifyTransaction } from "./paystack.server";
import { applyVerifiedCharge } from "./paystack-charge.server";
import { requireAuth } from "@/lib/auth/require-auth.server";
import { errorBoundary } from "@/lib/error-boundary.server";
import { communityIdForAdmin } from "./communities.functions";
import { resolveActiveMember } from "@/lib/membership/active-member.server";
import { toDateOnlyString } from "@/lib/date-only";
import { monthsPerPeriod, parseYm, addMonths, ymToDateStr, ymAfter, periodUnit } from "@/lib/dues-period";
import { computeCommunityArrears } from "@/lib/dues-arrears.server";
import { sendEmailsBatch } from "@/lib/email";
import { duesReminderEmail } from "@/lib/email-templates";

function formatMoney(currency: "NGN" | "USD", amount: number): string {
  return `${currency === "NGN" ? "₦" : "$"}${Math.round(amount).toLocaleString()}`;
}

const StartDuesInput = z.object({
  plan_id: z.string().uuid(),
  currency: z.enum(["NGN", "USD"]),
  member_name: z.string().min(1).max(120),
  member_email: z.string().email().max(200),
  // How many billing periods this single payment covers, and which period it
  // starts from (first-of-month). Both default sensibly for a plain one-off.
  months: z.number().int().min(1).max(12).default(1),
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const startDuesCheckout = createServerFn({ method: "POST" })
  .middleware([errorBoundary])
  .inputValidator((input) => StartDuesInput.parse(input))
  .handler(async ({ data }) => {
    const rows = await sql`
      SELECT dp.id, dp.name, dp.amount_ngn, dp.amount_usd, dp.active,
        c.paystack_subaccount_code
      FROM public.dues_plans dp
      JOIN public.communities c ON c.id = dp.community_id
      WHERE dp.id = ${data.plan_id}
      LIMIT 1
    `;
    const plan = rows[0];
    if (!plan || !plan.active) throw new Error("Plan not available");
    const unitAmount = data.currency === "NGN" ? plan.amount_ngn : plan.amount_usd;
    if (!unitAmount) throw new Error(`${data.currency} not offered for this plan`);

    // One payment can cover several periods — charge unit price × months.
    const total = Number(unitAmount) * data.months;

    const host = getRequestHost();
    const proto = host.includes("localhost") ? "http" : "https";
    const callback_url = `${proto}://${host}/pay-dues/${plan.id}?status=success`;

    // Subaccounts are an NGN-rails feature — USD always stays on the
    // platform-held/manual-payout path regardless of whether one exists.
    const subaccount_code = data.currency === "NGN" ? (plan.paystack_subaccount_code as string | null) : null;
    const settlement_mode = subaccount_code ? "subaccount_split" : "platform_held";

    const tx = await initializeTransaction({
      email: data.member_email,
      amount: total,
      currency: data.currency,
      callback_url,
      subaccount: subaccount_code ?? undefined,
      metadata: {
        kind: "dues",
        plan_id: plan.id,
        member_name: data.member_name,
        settlement_mode,
        months: data.months,
        period_start: data.period_start ?? null,
      },
    });
    return { authorization_url: tx.authorization_url, reference: tx.reference };
  });

// Public: confirms a just-completed dues payment when the payer's browser
// lands back on /pay-dues/:planId after Paystack checkout. Mirrors
// tiers.functions.ts's verifyPlanPayment — the webhook (paystack-webhook.ts)
// is the source of truth and will also apply the charge, but it runs async
// and may not have landed by the time the browser redirects back, which is
// exactly when the payer wants to see a confirmed status. applyVerifiedCharge
// is idempotent (ON CONFLICT DO NOTHING on provider+reference), so whichever
// of the two call sites runs first wins and the other is a no-op.
export const verifyDuesPayment = createServerFn({ method: "POST" })
  .middleware([errorBoundary])
  .inputValidator((i) => z.object({ reference: z.string().min(1), plan_id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const tx = await verifyTransaction(data.reference);
    const meta = (tx.metadata ?? {}) as Record<string, any>;
    if (meta.kind !== "dues" || meta.plan_id !== data.plan_id) {
      throw new Error("This payment reference doesn't match this dues plan.");
    }

    const result = await applyVerifiedCharge(tx);
    return {
      ok: result.applied,
      status: tx.status as string,
      amount: Number(tx.amount) / 100,
      currency: tx.currency as "NGN" | "USD",
      reference: tx.reference as string,
      memberName: (meta.member_name as string | undefined) ?? null,
    };
  });

// Public: a dues plan's checkout details (no auth — this is a shareable pay link).
export const getDuesPlan = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ plan_id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const rows = await sql`
      SELECT id, name, amount_ngn, amount_usd, interval, active
      FROM public.dues_plans
      WHERE id = ${data.plan_id}
      LIMIT 1
    `;
    const plan = rows[0];
    if (!plan || !plan.active) return null;
    return plan;
  });

// ── Member: dues status + own payment history ───────────────────────────

export const getMyDuesInfo = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const member = await resolveActiveMember(context.userId, context.activeCommunityId);
    if (!member) {
      return {
        plan: null as { interval: "monthly" | "quarterly" | "yearly"; amountNgn: number | null; amountUsd: number | null } | null,
        coverage: { nextDue: null as string | null },
        history: [] as { id: string; amount: number; currency: "NGN" | "USD"; status: string; date: string; months: number; periodStart: string | null }[],
      };
    }

    const plans = await sql`
      SELECT interval, amount_ngn, amount_usd
      FROM public.dues_plans
      WHERE community_id = ${member.communityId}::uuid AND active = true
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const planRow = plans[0];
    const plan = planRow
      ? {
          interval: planRow.interval as "monthly" | "quarterly" | "yearly",
          amountNgn: planRow.amount_ngn != null ? Number(planRow.amount_ngn) : null,
          amountUsd: planRow.amount_usd != null ? Number(planRow.amount_usd) : null,
        }
      : null;

    const history = member.email
      ? await sql`
          SELECT dp.id, dp.amount, dp.currency, dp.status, dp.paid_at, dp.months, dp.period_start
          FROM public.dues_payments dp
          JOIN public.dues_plans p ON p.id = dp.plan_id
          WHERE p.community_id = ${member.communityId}::uuid AND lower(dp.member_email) = lower(${member.email})
          ORDER BY dp.paid_at DESC
          LIMIT 20
        `
      : [];

    // How far the member is paid through: the latest period covered by any
    // successful payment that recorded a period. nextDue is the first period
    // NOT yet covered — what the checkout should default the start to.
    const mpp = monthsPerPeriod(plan?.interval);
    let nextDue: ReturnType<typeof addMonths> | null = null;
    for (const r of history) {
      if (r.status !== "paid" || !r.period_start) continue;
      const start = parseYm(toDateOnlyString(r.period_start));
      const end = addMonths(start, Number(r.months ?? 1) * mpp); // first uncovered period
      if (!nextDue || ymAfter(end, nextDue)) nextDue = end;
    }

    return {
      plan,
      coverage: { nextDue: nextDue ? ymToDateStr(nextDue) : null },
      history: history.map((r) => ({
        id: r.id as string,
        amount: Number(r.amount),
        currency: r.currency as "NGN" | "USD",
        status: r.status as string,
        date: new Date(r.paid_at as string).toLocaleDateString(),
        months: Number(r.months ?? 1),
        periodStart: r.period_start ? toDateOnlyString(r.period_start) : null,
      })),
    };
  });

// ── Admin: dues setup + payment history ────────────────────────────────

// The admin's community's currently active dues plan, if any.
export const getMyDuesPlan = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const communityId = await communityIdForAdmin(context.userId, context.activeCommunityId);
    if (!communityId) return null;
    const rows = await sql`
      SELECT id, name, interval, amount_ngn, amount_usd, created_at
      FROM public.dues_plans
      WHERE community_id = ${communityId}::uuid AND active = true
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id as string,
      name: row.name as string,
      interval: row.interval as "monthly" | "quarterly" | "yearly",
      amountNgn: row.amount_ngn != null ? Number(row.amount_ngn) : null,
      amountUsd: row.amount_usd != null ? Number(row.amount_usd) : null,
    };
  });

// Creates (or replaces) the community's active dues plan. The old plan is
// deactivated rather than deleted, so its payment history stays intact.
export const saveDuesPlan = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((i) =>
    z
      .object({
        name: z.string().min(1).max(120),
        interval: z.enum(["monthly", "quarterly", "yearly"]),
        amountNgn: z.number().positive().nullable().optional(),
        amountUsd: z.number().positive().nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    if (!data.amountNgn && !data.amountUsd) throw new Error("Set an amount in at least one currency.");
    const communityId = await communityIdForAdmin(context.userId, context.activeCommunityId);
    if (!communityId) throw new Error("You don't manage a community yet.");

    await sql`UPDATE public.dues_plans SET active = false WHERE community_id = ${communityId}::uuid AND active = true`;
    await sql`
      INSERT INTO public.dues_plans (community_id, name, interval, amount_ngn, amount_usd, active)
      VALUES (${communityId}::uuid, ${data.name}, ${data.interval}, ${data.amountNgn ?? null}, ${data.amountUsd ?? null}, true)
    `;
    return { ok: true };
  });

// Recent dues payments across the admin's community (any plan, past or
// current), newest first.
export const listDuesPayments = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const communityId = await communityIdForAdmin(context.userId, context.activeCommunityId);
    if (!communityId) return [];
    const rows = await sql`
      SELECT dp.id, dp.member_name, dp.amount, dp.currency, dp.status, dp.paid_at
      FROM public.dues_payments dp
      JOIN public.dues_plans p ON p.id = dp.plan_id
      WHERE p.community_id = ${communityId}::uuid
      ORDER BY dp.paid_at DESC
      LIMIT 200
    `;
    return rows.map((r) => ({
      id: r.id as string,
      member: r.member_name as string,
      amount: Number(r.amount),
      currency: r.currency as "NGN" | "USD",
      status: r.status as string,
      paidAt: r.paid_at as string, // ISO, for programmatic date filtering
      date: new Date(r.paid_at as string).toLocaleDateString(),
    }));
  });

// ── Admin: arrears ledger + reminders ──────────────────────────────────

// The dues-arrears ledger for the admin's community: a per-member "who's
// behind and by how much", plus headline collection stats. Members array is
// the defaulters only (those with 1+ periods outstanding), most-behind first.
export const getDuesArrears = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const communityId = await communityIdForAdmin(context.userId, context.activeCommunityId);
    if (!communityId) return { plan: null, summary: null, defaulters: [] as ArrearsDefaulter[] };

    const { plan, members } = await computeCommunityArrears(communityId);
    if (!plan) return { plan: null, summary: null, defaulters: [] as ArrearsDefaulter[] };

    // Collection rate is period-based (periods paid ÷ periods due), which is
    // currency-agnostic — the right choice now that a community can owe in a
    // mix of ₦ and $. Each member's paid periods are capped at what they owe so
    // an over-payer can't push it past 100%. Outstanding money is tracked per
    // currency so mixed-currency communities read correctly.
    let expectedPeriods = 0;
    let paidPeriods = 0;
    let defaulterCount = 0;
    const outstanding: Record<"NGN" | "USD", number> = { NGN: 0, USD: 0 };
    for (const m of members) {
      expectedPeriods += m.expectedPeriods;
      paidPeriods += Math.min(m.paidPeriods, m.expectedPeriods);
      outstanding[m.currency] += m.amountOwed;
      if (m.periodsBehind > 0) defaulterCount++;
    }
    const collectionRate = expectedPeriods > 0 ? Math.round((paidPeriods / expectedPeriods) * 100) : 100;

    // "₦45,000 · $120" — only currencies with something outstanding.
    const outParts: string[] = [];
    if (outstanding.NGN > 0) outParts.push(formatMoney("NGN", outstanding.NGN));
    if (outstanding.USD > 0) outParts.push(formatMoney("USD", outstanding.USD));
    const totalOutstandingLabel = outParts.length > 0 ? outParts.join(" · ") : formatMoney(plan.primaryCurrency, 0);

    const defaulters: ArrearsDefaulter[] = members
      .filter((m) => m.periodsBehind > 0)
      .map((m) => ({
        memberId: m.memberId,
        name: m.name,
        email: m.email,
        phone: m.phone,
        currency: m.currency,
        periodsBehind: m.periodsBehind,
        amountOwed: m.amountOwed,
        amountLabel: formatMoney(m.currency, m.amountOwed),
        lastPaidAt: m.lastPaidAt,
        lastRemindedAt: m.lastRemindedAt,
        hasEmail: !!m.email,
      }));

    return {
      plan: { interval: plan.interval },
      summary: {
        activeMembers: members.length,
        defaulters: defaulterCount,
        collectionRate,
        outstandingNgn: outstanding.NGN,
        outstandingUsd: outstanding.USD,
        totalOutstandingLabel,
      },
      defaulters,
    };
  });

type ArrearsDefaulter = {
  memberId: string;
  name: string;
  email: string | null;
  phone: string | null;
  currency: "NGN" | "USD";
  periodsBehind: number;
  amountOwed: number;
  amountLabel: string;
  lastPaidAt: string | null;
  lastRemindedAt: string | null;
  hasEmail: boolean;
};

// Emails a dues reminder to defaulters. With `memberIds`, reminds exactly those
// (that are still in arrears and have an email); with none, reminds every
// defaulter with an email. Records last_dues_reminder_at for everyone actually
// emailed. This is the manual "Send reminders" path — the cron path
// (runDuesReminderJob) reuses the same arrears + template, but self-throttles.
export const sendDuesReminders = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((i) =>
    z.object({ memberIds: z.array(z.string().uuid()).max(5000).optional() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const communityId = await communityIdForAdmin(context.userId, context.activeCommunityId);
    if (!communityId) throw new Error("You don't manage a community yet.");

    const { plan, members } = await computeCommunityArrears(communityId);
    if (!plan) throw new Error("Set up a dues plan before sending reminders.");

    const commRows = await sql`SELECT name FROM public.communities WHERE id = ${communityId}::uuid LIMIT 1`;
    const communityName = (commRows[0]?.name as string | undefined) ?? "your community";

    const host = getRequestHost();
    const proto = host.includes("localhost") ? "http" : "https";
    const payUrl = `${proto}://${host}/pay-dues/${plan.id}`;
    const periodWord = periodUnit(plan.interval);

    const wanted = data.memberIds ? new Set(data.memberIds) : null;
    const targets = members.filter(
      (m) => m.periodsBehind > 0 && m.email && (!wanted || wanted.has(m.memberId)),
    );
    if (targets.length === 0) return { sent: 0, failed: 0, skipped: 0 };

    const messages = targets.map((m) => ({
      to: m.email as string,
      id: m.memberId,
      subject: `Dues reminder — ${communityName}`,
      fromName: communityName,
      html: duesReminderEmail({
        memberName: m.name,
        communityName,
        amountLabel: formatMoney(m.currency, m.amountOwed),
        periodsBehind: m.periodsBehind,
        periodWord,
        payUrl,
      }),
    }));

    const { sent, failed, okIds } = await sendEmailsBatch(messages);
    if (okIds.length > 0) {
      await sql`
        UPDATE public.members
        SET last_dues_reminder_at = now()
        WHERE id = ANY(${okIds}::uuid[])
      `;
    }
    // Members skipped because we have no email on file for them.
    const skipped = members.filter((m) => m.periodsBehind > 0 && !m.email && (!wanted || wanted.has(m.memberId))).length;
    return { sent, failed, skipped };
  });

// Public: the id of the most recently created active dues plan, so members
// can be routed to a pay link without exposing the whole table.
// Was previously unscoped (any active plan across ALL communities) — a bug
// once more than one community exists. Now resolves the logged-in member's
// own community first.
export const getActiveDuesPlanId = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const member = await resolveActiveMember(context.userId, context.activeCommunityId);
    if (!member) return null;
    const rows = await sql`
      SELECT id
      FROM public.dues_plans
      WHERE community_id = ${member.communityId}::uuid AND active = true
      ORDER BY created_at DESC
      LIMIT 1
    `;
    return rows[0]?.id ?? null;
  });
