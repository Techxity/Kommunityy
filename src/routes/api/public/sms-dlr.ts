import { createFileRoute } from "@tanstack/react-router";
import { sql } from "@/lib/db/client";
import { refundFunds } from "@/lib/sms/wallet.server";
import { checkDlrToken, classifyDlrStatus, parseDlrPayload } from "@/lib/sms/dlr";

// SMS delivery-report webhook. BulkSMSNigeria POSTs one final status per
// recipient to the callback_url we pass on each send; we match it to our
// sms_messages row by message_id, mark it delivered/failed, and REFUND the
// wallet for anything that failed — so a community only pays for texts that
// were actually delivered.
//
// The webhook isn't signed: the send pipeline appends ?token=SMS_DLR_TOKEN to
// the callback URL and we require it here (fails closed when unset).
//
// Idempotent: every transition is a guarded UPDATE from status='sent', so a
// retried callback (up to 3 attempts) changes nothing and never double-refunds.

export const Route = createFileRoute("/api/public/sms-dlr")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = checkDlrToken(request.url, process.env.SMS_DLR_TOKEN);
        if (auth === "unconfigured") return new Response("SMS_DLR_TOKEN is not configured", { status: 503 });
        if (auth === "unauthorized") return new Response("Unauthorized", { status: 401 });

        let body: any;
        try {
          body = await request.json();
        } catch {
          return new Response("Bad JSON", { status: 400 });
        }

        const parsed = parseDlrPayload(body);
        if (!parsed) return new Response("ignored", { status: 200 });
        const { messageId, status } = parsed;

        try {
          if (classifyDlrStatus(status) === "delivered") {
            await sql`
              UPDATE public.sms_messages SET status = 'delivered'
              WHERE provider_message_id = ${messageId} AND status = 'sent'
            `;
          } else {
            const rows = await sql`
              UPDATE public.sms_messages
              SET status = 'failed', error = ${status.slice(0, 200)}
              WHERE provider_message_id = ${messageId} AND status = 'sent'
              RETURNING community_id, cost_kobo
            `;
            const row = rows[0];
            if (row && Number(row.cost_kobo) > 0) {
              await refundFunds(row.community_id as string, Number(row.cost_kobo), `dlr:${messageId}`, { status });
            }
          }
        } catch (e: any) {
          console.error("[sms-dlr]", e?.message ?? e);
          // Still 200 so the provider doesn't hammer retries; we log for follow-up.
        }
        return new Response("ok", { status: 200 });
      },
    },
  },
});
