import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyWebhookSignature, verifyTransaction } from "@/lib/payments/paystack.server";

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

        if (event?.event !== "charge.success") {
          return new Response("ignored", { status: 200 });
        }

        const reference: string = event.data?.reference;
        // Re-verify against Paystack as defense-in-depth.
        const tx = await verifyTransaction(reference);
        if (tx.status !== "success") {
          return new Response("not successful", { status: 200 });
        }

        const meta = tx.metadata ?? {};
        const currency = tx.currency as "NGN" | "USD";
        const amount = Number(tx.amount) / 100;
        const email = tx.customer?.email as string | undefined;

        if (meta.kind === "donation" && meta.donation_id) {
          await supabaseAdmin.from("donation_payments").insert({
            donation_id: meta.donation_id,
            payer_name: meta.payer_name ?? email ?? "Anonymous",
            payer_email: email ?? null,
            amount,
            currency,
            provider: "paystack",
            provider_ref: reference,
            status: "paid",
          });
        } else if (meta.kind === "dues" && meta.plan_id) {
          await supabaseAdmin.from("dues_payments").insert({
            plan_id: meta.plan_id,
            member_name: meta.member_name ?? email ?? "Member",
            member_email: email ?? null,
            amount,
            currency,
            provider: "paystack",
            provider_ref: reference,
            status: "paid",
          });
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
