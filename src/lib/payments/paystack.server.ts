// Server-only Paystack adapter. Do not import from client code.
import { createHmac, timingSafeEqual } from "crypto";

const BASE = "https://api.paystack.co";

function key() {
  const k = process.env.PAYSTACK_SECRET_KEY;
  if (!k) throw new Error("PAYSTACK_SECRET_KEY not set");
  return k;
}

export async function initializeTransaction(args: {
  email: string;
  amount: number; // major units (e.g. 5000 NGN, 30 USD)
  currency: "NGN" | "USD";
  callback_url: string;
  metadata?: Record<string, unknown>;
  reference?: string;
}): Promise<{ authorization_url: string; reference: string; access_code: string }> {
  const res = await fetch(`${BASE}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: args.email,
      amount: Math.round(args.amount * 100), // kobo / cents
      currency: args.currency,
      callback_url: args.callback_url,
      metadata: args.metadata ?? {},
      reference: args.reference,
    }),
  });
  const json = (await res.json()) as { status: boolean; message: string; data?: any };
  if (!res.ok || !json.status || !json.data) {
    throw new Error(`Paystack init failed: ${json.message ?? res.statusText}`);
  }
  return json.data;
}

export async function verifyTransaction(reference: string) {
  const res = await fetch(`${BASE}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${key()}` },
  });
  const json = (await res.json()) as { status: boolean; message: string; data?: any };
  if (!res.ok || !json.status) {
    throw new Error(`Paystack verify failed: ${json.message ?? res.statusText}`);
  }
  return json.data;
}

// Paystack signs webhooks with HMAC SHA512 of the raw body using the secret key.
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false;
  const expected = createHmac("sha512", key()).update(rawBody).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}
