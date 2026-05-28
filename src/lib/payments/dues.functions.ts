import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRequestHost } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
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
    const { data: plan, error } = await supabaseAdmin
      .from("dues_plans")
      .select("id, name, amount_ngn, amount_usd, active")
      .eq("id", data.plan_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
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
