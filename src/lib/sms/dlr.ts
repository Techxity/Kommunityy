// Pure helpers for the delivery-report webhook (src/routes/api/public/sms-dlr.ts),
// kept separate so they're unit-testable.

// BulkSMSNigeria only calls back with a FINAL status. Their docs: delivrd /
// delivered / success mean delivered; anything else (including statuses they
// add later) means not delivered — so we refund it.
export function classifyDlrStatus(status: string): "delivered" | "failed" {
  const s = status.trim().toLowerCase();
  return s === "delivrd" || s === "delivered" || s === "success" ? "delivered" : "failed";
}

// Payload fields are top-level, duplicated under `data` for older integrations.
export function parseDlrPayload(body: any): { messageId: string; status: string } | null {
  const src = body && typeof body === "object" ? body : {};
  const data = src.data && typeof src.data === "object" ? src.data : {};
  const messageId = src.message_id ?? data.message_id;
  const status = src.delivery_status ?? data.delivery_status;
  if (!messageId || !status) return null;
  return { messageId: String(messageId), status: String(status) };
}

export function constantTimeEqual(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

// The webhook isn't signed, so a secret token in the callback URL is the guard.
// Fails closed: no SMS_DLR_TOKEN configured → reject everything.
export function checkDlrToken(url: string, secret: string | undefined): "ok" | "unconfigured" | "unauthorized" {
  if (!secret) return "unconfigured";
  const given = new URL(url).searchParams.get("token") ?? "";
  return constantTimeEqual(given, secret) ? "ok" : "unauthorized";
}
