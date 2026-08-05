import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertCommunityAdmin, assertSuperAdmin } from "./authz";
import { initiateTransfer } from "./paystack.server";


async function getAvailable(
  community_id: string,
  currency: "NGN" | "USD",
  source: "dues" | "donations",
) {
  const { data, error } = await supabaseAdmin
    .from("community_balances_by_source")
    .select("available")
    .eq("community_id", community_id)
    .eq("currency", currency)
    .eq("source", source)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Number(data?.available ?? 0);
}

export const requestPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        community_id: z.string().uuid(),
        currency: z.enum(["NGN", "USD"]),
        source: z.enum(["dues", "donations"]),
        amount: z.number().positive(),
        notes: z.string().max(500).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertCommunityAdmin(context.supabase, context.userId, data.community_id);

    const { data: community, error: cErr } = await supabaseAdmin
      .from("communities")
      .select("bank_code, account_number")
      .eq("id", data.community_id)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!community?.bank_code || !community?.account_number) {
      throw new Error("Add bank details in Settings before requesting a payout");
    }

    const available = await getAvailable(data.community_id, data.currency, data.source);
    if (data.amount > available) {
      throw new Error(
        `Only ${data.currency} ${available.toLocaleString()} available in ${data.source}`,
      );
    }

    const { data: row, error } = await supabaseAdmin
      .from("payouts")
      .insert({
        community_id: data.community_id,
        currency: data.currency,
        source: data.source,
        amount: data.amount,
        notes: data.notes ?? null,
        status: "requested",
        requested_by: context.userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const approvePayoutPaystack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ payout_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);

    const { data: payout, error } = await supabaseAdmin
      .from("payouts")
      .select("id, community_id, amount, currency, status")
      .eq("id", data.payout_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!payout) throw new Error("Payout not found");
    if (payout.status !== "requested") throw new Error("Payout is not pending");

    const { data: community, error: cErr } = await supabaseAdmin
      .from("communities")
      .select("paystack_recipient_code, name")
      .eq("id", payout.community_id)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!community?.paystack_recipient_code) {
      throw new Error("Community has no Paystack recipient — use Mark as manually paid");
    }

    const tx = await initiateTransfer({
      amount: Number(payout.amount),
      recipient_code: community.paystack_recipient_code,
      reason: `Payout to ${community.name}`,
      currency: payout.currency as "NGN" | "USD",
    });

    const { error: uErr } = await supabaseAdmin
      .from("payouts")
      .update({
        status: "approved",
        method: "paystack_transfer",
        paystack_transfer_code: tx.transfer_code,
        paystack_transfer_ref: tx.reference,
        approved_by: context.userId,
        approved_at: new Date().toISOString(),
      })
      .eq("id", payout.id);
    if (uErr) throw new Error(uErr.message);

    return { transfer_code: tx.transfer_code };
  });

export const markPayoutPaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        payout_id: z.string().uuid(),
        note: z.string().max(500).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);

    const { error } = await supabaseAdmin
      .from("payouts")
      .update({
        status: "paid",
        method: "manual",
        approved_by: context.userId,
        approved_at: new Date().toISOString(),
        paid_at: new Date().toISOString(),
        notes: data.note ?? null,
      })
      .eq("id", data.payout_id)
      .in("status", ["requested", "approved"]);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const rejectPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ payout_id: z.string().uuid(), reason: z.string().max(500) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);

    const { error } = await supabaseAdmin
      .from("payouts")
      .update({
        status: "rejected",
        failed_reason: data.reason,
        approved_by: context.userId,
        approved_at: new Date().toISOString(),
      })
      .eq("id", data.payout_id)
      .eq("status", "requested");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Super-admin-only listing that includes community bank details.
export const listPayoutRequests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ pending_only: z.boolean().default(false) }).parse(i))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    let q = supabaseAdmin
      .from("payouts")
      .select(
        "id, amount, currency, source, status, method, requested_at, paid_at, notes, failed_reason, community_id, community:communities!inner(name, bank_name, account_number, account_name, paystack_recipient_code)",
      )
      .order("requested_at", { ascending: false });
    if (data.pending_only) q = q.in("status", ["requested", "approved"]);
    const { data: rows, error } = await q;
    if (error) throw new Error("Could not load payout requests");
    return rows ?? [];
  });
