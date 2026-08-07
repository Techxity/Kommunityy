import { createFileRoute } from "@tanstack/react-router";
import { verifyWebhookSignature, verifyTransaction } from "@/lib/payments/paystack.server";
import { applyVerifiedCharge } from "@/lib/payments/paystack-charge.server";
import { sql } from "@/lib/db/client";

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
          await applyVerifiedCharge(tx);
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
