import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRequestHost } from "@tanstack/react-start/server";
import { sql } from "@/lib/db/client";
import { initializeTransaction } from "./paystack.server";

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

// Public: the id of the most recently created active dues plan, so members
// can be routed to a pay link without exposing the whole table.
export const getActiveDuesPlanId = createServerFn({ method: "POST" }).handler(async () => {
  const rows = await sql`
    SELECT id
    FROM public.dues_plans
    WHERE active = true
    ORDER BY created_at DESC
    LIMIT 1
  `;
  return rows[0]?.id ?? null;
});
