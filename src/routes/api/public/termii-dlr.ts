import { createFileRoute } from "@tanstack/react-router";
import { sql } from "@/lib/db/client";
import { refundFunds } from "@/lib/sms/wallet.server";

// Termii delivery-status (DLR) webhook. Termii POSTs a status update for each
// message it processed; we match it to our sms_messages row by the message_id
// we stored at send time, mark it delivered/failed, and REFUND the wallet for
// anything that ultimately failed at the carrier — so a community only ever
// pays for texts that were actually delivered/accepted.
//
// Configure this URL in the Termii dashboard. If SMS_DLR_TOKEN is set, Termii
// must include it as ?token=… (Termii DLR isn't signed, so this is the guard).
//
// Idempotent: every transition is a guarded UPDATE from status='sent', so a
// duplicate callback (Termii retries) changes nothing and never double-refunds.

function classify(status: string): "delivered" | "failed" | "pending" {
  const s = status.toLowerCase();
  if (/deliver/.test(s)) return "delivered";
  if (/reject|undeliver|expired|fail|dnd|blacklist|not.?sent|invalid/.test(s)) return "failed";
  return "pending"; // "Sent", "Message Sent", etc. — no state change yet
}

export const Route = createFileRoute("/api/public/termii-dlr")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = process.env.SMS_DLR_TOKEN;
        if (token) {
          const url = new URL(request.url);
          if (url.searchParams.get("token") !== token) {
            return new Response("Unauthorized", { status: 401 });
          }
        }

        let body: any;
        try {
          body = await request.json();
        } catch {
          return new Response("Bad JSON", { status: 400 });
        }

        const messageId: string | undefined = body?.message_id ?? body?.id;
        const status: string = String(body?.status ?? "");
        if (!messageId || !status) return new Response("ignored", { status: 200 });

        const outcome = classify(status);
        try {
          if (outcome === "delivered") {
            await sql`
              UPDATE public.sms_messages SET status = 'delivered'
              WHERE provider_message_id = ${messageId} AND status = 'sent'
            `;
          } else if (outcome === "failed") {
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
          console.error("[termii-dlr]", e?.message ?? e);
          // Still 200 so Termii doesn't hammer retries; we log for follow-up.
        }
        return new Response("ok", { status: 200 });
      },
    },
  },
});
