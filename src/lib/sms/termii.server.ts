// Termii provider adapter (server-only). Kept behind a small SmsProvider
// interface so a second provider (Africa's Talking, a bulk reseller) can be
// dropped in without touching the wallet or send pipeline. Uses plain fetch —
// no SDK — so it runs fine on the edge runtime.
//
// Termii send response: { code:"ok", balance, message_id, ... }. A bulk/single
// call is accepted or rejected as a unit; there is no per-recipient status in
// the response (that arrives later via the delivery webhook — a fast-follow).

export type SmsSendResult = {
  ok: boolean;
  messageId?: string;
  balance?: number; // Termii ACCOUNT balance (operator reconciliation only)
  error?: string;
};

export interface SmsProvider {
  sendOne(args: {
    to: string; // 234XXXXXXXXXX
    from: string; // approved sender ID
    body: string;
    route: "dnd" | "generic";
    unicode: boolean;
  }): Promise<SmsSendResult>;
  getAccountBalance(): Promise<number | null>;
}

function baseUrl(): string {
  return (process.env.TERMII_BASE_URL || "https://api.ng.termii.com").replace(/\/+$/, "");
}

export const termii: SmsProvider = {
  async sendOne({ to, from, body, route, unicode }) {
    const apiKey = process.env.TERMII_API_KEY;
    if (!apiKey) return { ok: false, error: "TERMII_API_KEY isn't set." };
    try {
      const res = await fetch(`${baseUrl()}/api/sms/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey,
          to,
          from,
          sms: body,
          type: unicode ? "unicode" : "plain",
          channel: route,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as Record<string, any>;
      if (!res.ok || json.code !== "ok") {
        return { ok: false, error: `${res.status}: ${json.message ?? "send failed"}` };
      }
      return { ok: true, messageId: json.message_id as string, balance: Number(json.balance) };
    } catch (e: any) {
      return { ok: false, error: e?.message ?? "Termii request failed." };
    }
  },

  async getAccountBalance() {
    const apiKey = process.env.TERMII_API_KEY;
    if (!apiKey) return null;
    try {
      const res = await fetch(`${baseUrl()}/api/get-balance?api_key=${encodeURIComponent(apiKey)}`);
      const json = (await res.json().catch(() => ({}))) as Record<string, any>;
      if (!res.ok) return null;
      return Number(json.balance);
    } catch {
      return null;
    }
  },
};
