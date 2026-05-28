import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyWebhookSignature, verifyTransaction } from "@/lib/payments/paystack.server";

// Resolve the community for a given donation_id or dues plan_id.
async function communityForDonation(donation_id: string) {
  const { data } = await supabaseAdmin
    .from("donations")
    .select("community_id")
    .eq("id", donation_id)
    .maybeSingle();
  return data?.community_id ?? null;
}
async function communityForDuesPlan(plan_id: string) {
  const { data } = await supabaseAdmin
    .from("dues_plans")
    .select("community_id")
    .eq("id", plan_id)
    .maybeSingle();
  return data?.community_id ?? null;
}

async function platformFeePctFor(community_id: string): Promise<number> {
  const { data } = await supabaseAdmin
    .from("communities")
    .select("tier_id, subscription_tiers!inner(platform_fee_pct)")
    .eq("id", community_id)
    .maybeSingle();
  const pct = (data as any)?.subscription_tiers?.platform_fee_pct;
  return pct ? Number(pct) : 5; // sensible default
}

export const Route = createFileRoute("/api/public/paystack-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        const sig = request.headers.get("x-paystack-signature");
        if (!verifyWebhookSignature(raw, sig)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let event: any;
        try {
          event = JSON.parse(raw);
        } catch {
          return new Response("Bad JSON", { status: 400 });
        }

        // ── Charges ───────────────────────────────────────────────────────────
        if (event?.event === "charge.success") {
          const reference: string = event.data?.reference;
          const tx = await verifyTransaction(reference);
          if (tx.status !== "success") return new Response("not successful", { status: 200 });

          const meta = tx.metadata ?? {};
          const currency = tx.currency as "NGN" | "USD";
          const gross = Number(tx.amount) / 100;
          const paystack_fee = Number(tx.fees ?? 0) / 100;
          const email = tx.customer?.email as string | undefined;

          let community_id: string | null = null;
          if (meta.kind === "donation" && meta.donation_id) {
            community_id = await communityForDonation(meta.donation_id);
          } else if (meta.kind === "dues" && meta.plan_id) {
            community_id = await communityForDuesPlan(meta.plan_id);
          }
          const pct = community_id ? await platformFeePctFor(community_id) : 5;
          const platform_fee = Math.round(gross * pct) / 100;
          const community_net = Math.max(0, gross - platform_fee);

          if (meta.kind === "donation" && meta.donation_id) {
            await supabaseAdmin.from("donation_payments").insert({
              donation_id: meta.donation_id,
              payer_name: meta.payer_name ?? email ?? "Anonymous",
              payer_email: email ?? null,
              amount: gross,
              currency,
              provider: "paystack",
              provider_ref: reference,
              status: "paid",
              paystack_fee,
              platform_fee,
              community_net,
            });
          } else if (meta.kind === "dues" && meta.plan_id) {
            await supabaseAdmin.from("dues_payments").insert({
              plan_id: meta.plan_id,
              member_name: meta.member_name ?? email ?? "Member",
              member_email: email ?? null,
              amount: gross,
              currency,
              provider: "paystack",
              provider_ref: reference,
              status: "paid",
              paystack_fee,
              platform_fee,
              community_net,
            });
          }
          return new Response("ok", { status: 200 });
        }

        // ── Transfers (payouts) ───────────────────────────────────────────────
        if (
          event?.event === "transfer.success" ||
          event?.event === "transfer.failed" ||
          event?.event === "transfer.reversed"
        ) {
          const code = event.data?.transfer_code as string | undefined;
          if (!code) return new Response("ignored", { status: 200 });
          const status =
            event.event === "transfer.success"
              ? "paid"
              : event.event === "transfer.failed"
              ? "failed"
              : "failed";
          const patch: {
            status: "paid" | "failed";
            paid_at?: string;
            failed_reason?: string;
          } = { status };
          if (status === "paid") patch.paid_at = new Date().toISOString();
          if (status === "failed") patch.failed_reason = event.data?.reason ?? "Reversed";
          await supabaseAdmin.from("payouts").update(patch).eq("paystack_transfer_code", code);
          return new Response("ok", { status: 200 });
        }

        return new Response("ignored", { status: 200 });
      },
    },
  },
});
