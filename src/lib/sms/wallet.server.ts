// The SMS wallet: a per-community prepaid balance whose source of truth is the
// sms_ledger. Every balance change goes through applyLedger, which updates the
// cached balance and writes a ledger row in one transaction. Overdraws are
// impossible: sms_wallets.balance_kobo has a CHECK (>= 0), so a debit larger
// than the balance rolls the whole transaction back. See
// docs/sms-wallet-architecture.md §4/§7a.
import { sql, withTransaction } from "@/lib/db/client";

export type LedgerKind = "topup" | "debit" | "refund" | "adjustment";

export type SmsSettings = {
  enabled: boolean;
  senderId: string | null;
  route: "dnd" | "generic";
  chBirthdays: boolean;
  chReminders: boolean;
  chBroadcasts: boolean;
  lowBalanceKobo: number;
};

// Make sure a community has its settings + wallet rows before we read/write.
export async function ensureSmsRows(communityId: string): Promise<void> {
  await sql`INSERT INTO public.community_sms_settings (community_id) VALUES (${communityId}::uuid) ON CONFLICT (community_id) DO NOTHING`;
  await sql`INSERT INTO public.sms_wallets (community_id) VALUES (${communityId}::uuid) ON CONFLICT (community_id) DO NOTHING`;
}

export async function getBalanceKobo(communityId: string): Promise<number> {
  const rows = await sql`SELECT balance_kobo FROM public.sms_wallets WHERE community_id = ${communityId}::uuid LIMIT 1`;
  return Number(rows[0]?.balance_kobo ?? 0);
}

export async function getSmsSettings(communityId: string): Promise<SmsSettings> {
  await ensureSmsRows(communityId);
  const rows = await sql`
    SELECT enabled, sender_id, route, ch_birthdays, ch_reminders, ch_broadcasts, low_balance_kobo
    FROM public.community_sms_settings WHERE community_id = ${communityId}::uuid LIMIT 1
  `;
  const r = rows[0] ?? {};
  return {
    enabled: !!r.enabled,
    senderId: (r.sender_id as string | null) ?? null,
    route: (r.route as "dnd" | "generic") ?? "dnd",
    chBirthdays: !!r.ch_birthdays,
    chReminders: !!r.ch_reminders,
    chBroadcasts: !!r.ch_broadcasts,
    lowBalanceKobo: Number(r.low_balance_kobo ?? 50000),
  };
}

// Applies a single balance change atomically (balance update + ledger row).
// deltaKobo is positive for credits (topup/refund/adjustment) and negative for
// debits. Returns false when a debit can't be covered (CHECK violation rolls
// back) — callers treat that as "insufficient funds", never a crash.
export async function applyLedger(
  communityId: string,
  deltaKobo: number,
  kind: LedgerKind,
  reference: string | null,
  meta: Record<string, unknown> = {},
): Promise<boolean> {
  await ensureSmsRows(communityId);
  try {
    await withTransaction((tx) => [
      tx`UPDATE public.sms_wallets SET balance_kobo = balance_kobo + ${deltaKobo}, updated_at = now() WHERE community_id = ${communityId}::uuid`,
      tx`INSERT INTO public.sms_ledger (community_id, delta_kobo, kind, reference, meta)
         VALUES (${communityId}::uuid, ${deltaKobo}, ${kind}, ${reference}, ${JSON.stringify(meta)}::jsonb)`,
    ]);
    return true;
  } catch {
    return false;
  }
}

// Credit the wallet (top-up, refund, admin adjustment). Never fails on balance.
export async function creditWallet(
  communityId: string,
  amountKobo: number,
  kind: Extract<LedgerKind, "topup" | "refund" | "adjustment">,
  reference: string | null,
  meta: Record<string, unknown> = {},
): Promise<boolean> {
  if (amountKobo <= 0) return true;
  return applyLedger(communityId, amountKobo, kind, reference, meta);
}

// Reserve (debit) funds up front. Returns false if the balance can't cover it —
// the transaction rolls back and nothing is charged. Callers should reserve
// BEFORE sending, then refund on send failure, so a community can never be
// billed for SMS it didn't get.
export async function reserveFunds(
  communityId: string,
  costKobo: number,
  reference: string | null,
  meta: Record<string, unknown> = {},
): Promise<boolean> {
  if (costKobo <= 0) return true;
  return applyLedger(communityId, -costKobo, "debit", reference, meta);
}

export async function refundFunds(
  communityId: string,
  costKobo: number,
  reference: string | null,
  meta: Record<string, unknown> = {},
): Promise<boolean> {
  if (costKobo <= 0) return true;
  return applyLedger(communityId, costKobo, "refund", reference, meta);
}
