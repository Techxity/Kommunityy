import { createFileRoute } from "@tanstack/react-router";
import { sql } from "@/lib/db/client";
import { verifyWebhookSignature, verifyTransaction } from "@/lib/payments/paystack.server";

// Resolve the community for a given donation_id or dues plan_id.
async function communityForDonation(donation_id: string) {
  const rows = await sql`SELECT community_id FROM public.donations WHERE id = ${donation_id} LIMIT 1`;
  return rows[0]?.community_id ?? null;
}
async function communityForDuesPlan(plan_id: string) {
  const rows = await sql`SELECT community_id FROM public.dues_plans WHERE id = ${plan_id} LIMIT 1`;
  return rows[0]?.community_id ?? null;
}

async function platformFeePctFor(community_id: string): Promise<number> {
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
            await sql`
              INSERT INTO public.donation_payments
                (donation_id, payer_name, payer_email, amount, currency, provider, provider_ref, status, paystack_fee, platform_fee, community_net)
              VALUES
                (${meta.donation_id}, ${meta.payer_name ?? email ?? "Anonymous"}, ${email ?? null}, ${gross}, ${currency}, 'paystack', ${reference}, 'paid', ${paystack_fee}, ${platform_fee}, ${community_net})
              ON CONFLICT (provider, provider_ref) DO NOTHING
            `;
          } else if (meta.kind === "dues" && meta.plan_id) {
            await sql`
              INSERT INTO public.dues_payments
                (plan_id, member_name, member_email, amount, currency, provider, provider_ref, status, paystack_fee, platform_fee, community_net)
              VALUES
                (${meta.plan_id}, ${meta.member_name ?? email ?? "Member"}, ${email ?? null}, ${gross}, ${currency}, 'paystack', ${reference}, 'paid', ${paystack_fee}, ${platform_fee}, ${community_net})
              ON CONFLICT (provider, provider_ref) DO NOTHING
            `;
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
          const status: "paid" | "failed" = event.event === "transfer.success" ? "paid" : "failed";
          const failed_reason = status === "failed" ? (event.data?.reason ?? "Reversed") : null;

          if (status === "paid") {
            await sql`
              UPDATE public.payouts SET status = 'paid', paid_at = now()
              WHERE paystack_transfer_code = ${code}
            `;
          } else {
            await sql`
              UPDATE public.payouts SET status = 'failed', failed_reason = ${failed_reason}
              WHERE paystack_transfer_code = ${code}
            `;
          }
          return new Response("ok", { status: 200 });
        }

        return new Response("ignored", { status: 200 });
      },
    },
  },
});
