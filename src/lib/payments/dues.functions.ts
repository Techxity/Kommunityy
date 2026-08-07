import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRequestHost } from "@tanstack/react-start/server";
import { sql } from "@/lib/db/client";
import { initializeTransaction } from "./paystack.server";
import { requireAuth } from "@/lib/auth/require-auth.server";
import { communityIdForAdmin } from "./communities.functions";

const StartDuesInput = z.object({
  plan_id: z.string().uuid(),
  currency: z.enum(["NGN", "USD"]),
  member_name: z.string().min(1).max(120),
  member_email: z.string().email().max(200),
});

export const startDuesCheckout = createServerFn({ method: "POST" })
  .inputValidator((input) => StartDuesInput.parse(input))
  .handler(async ({ data }) => {
    const rows = await sql`
      SELECT id, name, amount_ngn, amount_usd, active
      FROM public.dues_plans
      WHERE id = ${data.plan_id}
      LIMIT 1
    `;
    const plan = rows[0];
    if (!plan || !plan.active) throw new Error("Plan not available");
    const amount = data.currency === "NGN" ? plan.amount_ngn : plan.amount_usd;
    if (!amount) throw new Error(`${data.currency} not offered for this plan`);

    const host = getRequestHost();
    const proto = host.includes("localhost") ? "http" : "https";
    const callback_url = `${proto}://${host}/pay-dues/${plan.id}?status=success`;

    const tx = await initializeTransaction({
      email: data.member_email,
      amount: Number(amount),
      currency: data.currency,
      callback_url,
      metadata: {
        kind: "dues",
        plan_id: plan.id,
        member_name: data.member_name,
      },
    });
    return { authorization_url: tx.authorization_url, reference: tx.reference };
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

// Shared by member-facing dues functions below — resolves the logged-in
// user's own active membership row (id, community, email on file).
async function activeMemberFor(userId: string): Promise<{ memberId: string; communityId: string; email: string | null } | null> {
  const rows = await sql`
    SELECT id, community_id, email FROM public.members WHERE user_id = ${userId}::uuid AND status = 'active' LIMIT 1
  `;
  const row = rows[0];
  return row ? { memberId: row.id as string, communityId: row.community_id as string, email: (row.email as string | null) ?? null } : null;
}

// ── Member: dues status + own payment history ───────────────────────────

export const getMyDuesInfo = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const member = await activeMemberFor(context.userId);
    if (!member) return { plan: null, history: [] as { id: string; amount: number; currency: "NGN" | "USD"; status: string; date: string }[] };

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
          SELECT dp.id, dp.amount, dp.currency, dp.status, dp.paid_at
          FROM public.dues_payments dp
          JOIN public.dues_plans p ON p.id = dp.plan_id
          WHERE p.community_id = ${member.communityId}::uuid AND lower(dp.member_email) = lower(${member.email})
          ORDER BY dp.paid_at DESC
          LIMIT 20
        `
      : [];

    return {
      plan,
      history: history.map((r) => ({
        id: r.id as string,
        amount: Number(r.amount),
        currency: r.currency as "NGN" | "USD",
        status: r.status as string,
        date: new Date(r.paid_at as string).toLocaleDateString(),
      })),
    };
  });

// ── Admin: dues setup + payment history ────────────────────────────────

// The admin's community's currently active dues plan, if any.
export const getMyDuesPlan = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const communityId = await communityIdForAdmin(context.userId);
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
    const communityId = await communityIdForAdmin(context.userId);
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
    const communityId = await communityIdForAdmin(context.userId);
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

// Public: the id of the most recently created active dues plan, so members
// can be routed to a pay link without exposing the whole table.
// Was previously unscoped (any active plan across ALL communities) — a bug
// once more than one community exists. Now resolves the logged-in member's
// own community first.
export const getActiveDuesPlanId = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const member = await activeMemberFor(context.userId);
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
