// Shared logic for turning a verified (status === "success") Paystack
// transaction into real data — payment record +, for plan payments, the
// actual tier grant. Called from two places that can each be the first to
// observe a successful charge:
//   1. The Paystack webhook (src/routes/api/public/paystack-webhook.ts) —
//      server-to-server, usually fast but not guaranteed to arrive quickly.
//   2. The paying admin's own browser landing back on /admin/subscription
//      right after checkout (src/lib/payments/tiers.functions.ts's
//      verifyPlanPayment) — instant, but the webhook may not have landed
//      yet, which is exactly what left the sidebar stuck locked.
// Whichever runs first wins; the payment insert is idempotent via
// ON CONFLICT DO NOTHING on (provider, provider_ref), and the community
// UPDATE is a no-op to re-run.
import { sql } from "@/lib/db/client";

async function communityForDonation(donation_id: string) {
  const rows = await sql`SELECT community_id FROM public.donations WHERE id = ${donation_id} LIMIT 1`;
  return (rows[0]?.community_id as string | undefined) ?? null;
}
async function communityForDuesPlan(plan_id: string) {
  const rows = await sql`SELECT community_id FROM public.dues_plans WHERE id = ${plan_id} LIMIT 1`;
  return (rows[0]?.community_id as string | undefined) ?? null;
}
export async function platformFeePctFor(community_id: string): Promise<number> {
  const rows = await sql`
    SELECT t.platform_fee_pct
    FROM public.communities c
    JOIN public.subscription_tiers t ON t.id = c.tier_id
    WHERE c.id = ${community_id}
    LIMIT 1
  `;
  const pct = rows[0]?.platform_fee_pct;
  return pct ? Number(pct) : 5; // sensible default
}

export type VerifiedPaystackTx = {
  status: string;
  reference: string;
  metadata?: Record<string, unknown> | null;
  currency: string;
  amount: number;
  fees?: number;
  customer?: { email?: string } | null;
};

export async function applyVerifiedCharge(
  tx: VerifiedPaystackTx,
): Promise<{ applied: boolean; kind?: "donation" | "dues" | "plan" }> {
  if (tx.status !== "success") return { applied: false };

  const meta = (tx.metadata ?? {}) as Record<string, any>;
  const reference = tx.reference;
  const currency = tx.currency as "NGN" | "USD";
  const gross = Number(tx.amount) / 100;
  const paystack_fee = Number(tx.fees ?? 0) / 100;
  const email = tx.customer?.email;

  let community_id: string | null = null;
  if (meta.kind === "donation" && meta.donation_id) {
    community_id = await communityForDonation(meta.donation_id);
  } else if (meta.kind === "dues" && meta.plan_id) {
    community_id = await communityForDuesPlan(meta.plan_id);
  }
  const pct = community_id ? await platformFeePctFor(community_id) : 5;
  const platform_fee = Math.round(gross * pct) / 100;
  const community_net = Math.max(0, gross - platform_fee);

  // Set by dues.functions.ts/donations.functions.ts at checkout time based on
  // whether a Paystack subaccount was passed to /transaction/initialize —
  // trusted here as-is since it only affects which pool a payment is counted
  // toward for manual payouts, not the amount collected or who was charged.
  const settlement_mode: "platform_held" | "subaccount_split" =
    meta.settlement_mode === "subaccount_split" ? "subaccount_split" : "platform_held";

  if (meta.kind === "donation" && meta.donation_id) {
    await sql`
      INSERT INTO public.donation_payments
        (donation_id, payer_name, payer_email, amount, currency, provider, provider_ref, status, paystack_fee, platform_fee, community_net, settlement_mode)
      VALUES
        (${meta.donation_id}, ${meta.payer_name ?? email ?? "Anonymous"}, ${email ?? null}, ${gross}, ${currency}, 'paystack', ${reference}, 'paid', ${paystack_fee}, ${platform_fee}, ${community_net}, ${settlement_mode})
      ON CONFLICT (provider, provider_ref) DO NOTHING
    `;
    return { applied: true, kind: "donation" };
  }

  if (meta.kind === "dues" && meta.plan_id) {
    await sql`
      INSERT INTO public.dues_payments
        (plan_id, member_name, member_email, amount, currency, provider, provider_ref, status, paystack_fee, platform_fee, community_net, settlement_mode)
      VALUES
        (${meta.plan_id}, ${meta.member_name ?? email ?? "Member"}, ${email ?? null}, ${gross}, ${currency}, 'paystack', ${reference}, 'paid', ${paystack_fee}, ${platform_fee}, ${community_net}, ${settlement_mode})
      ON CONFLICT (provider, provider_ref) DO NOTHING
    `;
    return { applied: true, kind: "dues" };
  }

  if (meta.kind === "plan" && meta.community_id && meta.tier_id) {
    await sql`
      INSERT INTO public.plan_payments
        (community_id, tier_id, amount, currency, provider, provider_ref, status)
      VALUES
        (${meta.community_id}, ${meta.tier_id}, ${gross}, ${currency}, 'paystack', ${reference}, 'paid')
      ON CONFLICT (provider, provider_ref) DO NOTHING
    `;
    await sql`
      UPDATE public.communities
      SET tier_id = ${meta.tier_id}, trial_ends_at = NULL, suspended = false, updated_at = now()
      WHERE id = ${meta.community_id}
    `;
    return { applied: true, kind: "plan" };
  }

  return { applied: false };
}
