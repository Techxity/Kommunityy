// BulkSMSNigeria provider adapter (server-only), API v2. Plain fetch — no SDK —
// so it runs on any runtime. Docs: https://www.bulksmsnigeria.com/api
//
// Send response: { status:"success", code:"BSNG-0000", data:{ message_id, cost,
// skipped_recipients?, ... } } or { status:"error", code:"BSNG-XXXX",
// error:{ message } }. Errors never send or charge. Per-recipient delivery outcomes arrive later on
// the callback_url (see src/routes/api/public/sms-dlr.ts).
import type { SmsProvider, SmsSendResult } from "./provider-types";

export function bsngBaseUrl(): string {
  return (process.env.BULKSMSNIGERIA_BASE_URL || "https://www.bulksmsnigeria.com/api/v2").replace(/\/+$/, "");
}

// Our two routes map to BulkSMSNigeria gateways via env so the mapping can be
// tuned without a deploy-time code change. Their docs say corporate routes are
// what reach Do-Not-Disturb numbers; direct-refund is their default. A corporate
// send only reaches networks where the sender ID is approved for that route.
function gatewayFor(route: "dnd" | "generic"): string {
  return route === "dnd"
    ? process.env.SMS_GATEWAY_DND || "corporate"
    : process.env.SMS_GATEWAY_GENERIC || "direct-refund";
}

// Exported for tests. total_balance is the spendable total; sms_wallet alone can
// be a small part of it, which would raise false reserve alarms.
export function parseBalance(json: Record<string, any>): number | null {
  const b = json.balance ?? json.data?.balance ?? {};
  const ngn = Number(b.total_balance ?? b.sms_wallet);
  return Number.isFinite(ngn) ? ngn : null;
}

// Exported for tests: turns a parsed send response into our result shape.
export function parseSendResponse(httpStatus: number, json: Record<string, any>, to: string): SmsSendResult {
  if (httpStatus < 200 || httpStatus >= 300 || json.status !== "success") {
    const code = json.code ?? httpStatus;
    return { ok: false, error: `${code}: ${json.error?.message ?? json.message ?? "send failed"}` };
  }
  const data = (json.data ?? {}) as Record<string, any>;
  // Corporate/OTP routes skip (and don't charge) recipients on networks where
  // the sender ID isn't approved — for us that's a failed send to refund.
  const skipped: unknown[] = Array.isArray(data.skipped_recipients) ? data.skipped_recipients : [];
  if (skipped.some((s) => String(typeof s === "object" && s ? ((s as any).recipient ?? (s as any).number ?? "") : s) === to)) {
    return { ok: false, error: "skipped: sender ID not approved on this network" };
  }
  return { ok: true, messageId: data.message_id ? String(data.message_id) : undefined };
}

export const bulkSmsNigeria: SmsProvider = {
  async sendOne({ to, from, body, route, unicode, callbackUrl }) {
    const token = process.env.BULKSMSNIGERIA_API_TOKEN;
    if (!token) return { ok: false, error: "BULKSMSNIGERIA_API_TOKEN isn't set." };
    try {
      const res = await fetch(`${bsngBaseUrl()}/sms`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          from,
          to,
          body,
          gateway: gatewayFor(route),
          unicode,
          ...(callbackUrl ? { callback_url: callbackUrl } : {}),
        }),
      });
      const json = (await res.json().catch(() => ({}))) as Record<string, any>;
      // They fall back to direct-refund when a corporate route isn't available,
      // and that may not reach DND numbers, so leave a trace to follow up.
      if (json.route_notice ?? json.data?.route_notice) {
        console.warn("[sms] gateway fallback:", json.data?.requested_gateway ?? json.requested_gateway, json.route_notice ?? json.data?.route_notice);
      }
      return parseSendResponse(res.status, json, to);
    } catch (e: any) {
      return { ok: false, error: e?.message ?? "BulkSMSNigeria request failed." };
    }
  },

  async getAccountBalance() {
    const token = process.env.BULKSMSNIGERIA_API_TOKEN;
    if (!token) return null;
    try {
      const res = await fetch(`${bsngBaseUrl()}/balance`, {
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      return parseBalance((await res.json().catch(() => ({}))) as Record<string, any>);
    } catch {
      return null;
    }
  },
};
