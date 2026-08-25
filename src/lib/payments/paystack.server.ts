// Server-only Paystack adapter. Do not import from client code.
import { createHmac, timingSafeEqual } from "crypto";

const BASE = "https://api.paystack.co";

function key() {
  const k = process.env.PAYSTACK_SECRET_KEY?.trim();
  if (!k) throw new Error("PAYSTACK_SECRET_KEY is not set. Add your Paystack secret key to the environment.");
  // A real key is ASCII and starts with sk_. Guard against a masked/placeholder
  // value (e.g. the bullet-dotted •••• shown on the dashboard being copied),
  // which would otherwise throw an opaque "Cannot convert to ByteString" error
  // when the value is put into the Authorization header.
  if (!/^sk_[A-Za-z0-9_]+$/.test(k)) {
    throw new Error(
      "PAYSTACK_SECRET_KEY looks invalid. Use the real secret key from your Paystack dashboard (Settings → API Keys & Webhooks → reveal) — it starts with sk_test_ or sk_live_. It looks like a masked or placeholder value was pasted.",
    );
  }
  return k;
}

async function paystackFetch<T = any>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key()}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const json = (await res.json()) as { status: boolean; message: string; data?: T };
  if (!res.ok || !json.status) {
    throw new Error(`Paystack ${path} failed: ${json.message ?? res.statusText}`);
  }
  return json.data as T;
}

// ───── Checkout (charges) ────────────────────────────────────────────────────

export async function initializeTransaction(args: {
  email: string;
  amount: number; // major units
  currency: "NGN" | "USD";
  callback_url: string;
  metadata?: Record<string, unknown>;
  reference?: string;
  subaccount?: string; // Paystack subaccount_code — splits settlement to the community directly
}): Promise<{ authorization_url: string; reference: string; access_code: string }> {
  return paystackFetch("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email: args.email,
      amount: Math.round(args.amount * 100),
      currency: args.currency,
      callback_url: args.callback_url,
      metadata: args.metadata ?? {},
      reference: args.reference,
      subaccount: args.subaccount,
    }),
  });
}

export async function verifyTransaction(reference: string) {
  return paystackFetch<any>(`/transaction/verify/${encodeURIComponent(reference)}`);
}

// ───── Subaccounts (split settlement — community gets paid directly) ────────

// percentage_charge is the platform's cut; the remainder settles straight
// to the subaccount's bank account on the main account's normal settlement
// schedule (T+1 once approved by Paystack). NGN-rails only.
export async function createSubaccount(args: {
  business_name: string;
  bank_code: string;
  account_number: string;
  percentage_charge: number;
}): Promise<{ subaccount_code: string; percentage_charge: number }> {
  return paystackFetch("/subaccount", {
    method: "POST",
    body: JSON.stringify({
      business_name: args.business_name,
      bank_code: args.bank_code,
      account_number: args.account_number,
      percentage_charge: args.percentage_charge,
    }),
  });
}

export async function updateSubaccount(
  subaccount_code: string,
  args: { business_name?: string; bank_code?: string; account_number?: string; percentage_charge?: number },
): Promise<{ subaccount_code: string; percentage_charge: number }> {
  return paystackFetch(`/subaccount/${encodeURIComponent(subaccount_code)}`, {
    method: "PUT",
    body: JSON.stringify(args),
  });
}

// ───── Banks / recipients / transfers ────────────────────────────────────────

export async function listBanks(currency: "NGN" | "USD" = "NGN") {
  const country = currency === "USD" ? "ghana" : "nigeria"; // Paystack USD via Ghana rails varies; NGN default
  return paystackFetch<Array<{ name: string; code: string; currency: string }>>(
    `/bank?country=${country}&currency=${currency}`,
  );
}

export async function resolveAccount(account_number: string, bank_code: string) {
  return paystackFetch<{ account_number: string; account_name: string }>(
    `/bank/resolve?account_number=${account_number}&bank_code=${bank_code}`,
  );
}

export async function createTransferRecipient(args: {
  name: string;
  account_number: string;
  bank_code: string;
  currency: "NGN" | "USD";
}) {
  return paystackFetch<{ recipient_code: string }>("/transferrecipient", {
    method: "POST",
    body: JSON.stringify({
      type: "nuban",
      name: args.name,
      account_number: args.account_number,
      bank_code: args.bank_code,
      currency: args.currency,
    }),
  });
}

export async function initiateTransfer(args: {
  amount: number; // major units
  recipient_code: string;
  reason: string;
  reference?: string;
  currency?: "NGN" | "USD";
}) {
  return paystackFetch<{ transfer_code: string; reference: string; status: string }>(
    "/transfer",
    {
      method: "POST",
      body: JSON.stringify({
        source: "balance",
        amount: Math.round(args.amount * 100),
        recipient: args.recipient_code,
        reason: args.reason,
        reference: args.reference,
        currency: args.currency,
      }),
    },
  );
}

// ───── Webhook signature ─────────────────────────────────────────────────────

export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false;
  const expected = createHmac("sha512", key()).update(rawBody).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}
