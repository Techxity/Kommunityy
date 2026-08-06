import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { sql } from "@/lib/db/client";
import { requireAuth } from "@/lib/auth/require-auth.server";
import { assertCommunityAdmin, assertSuperAdmin } from "./authz";
import { initiateTransfer } from "./paystack.server";

async function getAvailable(
  community_id: string,
  currency: "NGN" | "USD",
  source: "dues" | "donations",
) {
  const rows = await sql`
    SELECT available
    FROM public.community_balances_by_source
    WHERE community_id = ${community_id} AND currency = ${currency} AND source = ${source}
    LIMIT 1
  `;
  return Number(rows[0]?.available ?? 0);
}

export const requestPayout = createServerFn({ method: "POST" })
  .middleware([requireAuth])
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
    await assertCommunityAdmin(context.userId, data.community_id);

    const communityRows = await sql`
      SELECT bank_code, account_number FROM public.communities WHERE id = ${data.community_id} LIMIT 1
    `;
    const community = communityRows[0];
    if (!community?.bank_code || !community?.account_number) {
      throw new Error("Add bank details in Settings before requesting a payout");
    }

    const available = await getAvailable(data.community_id, data.currency, data.source);
    if (data.amount > available) {
      throw new Error(
        `Only ${data.currency} ${available.toLocaleString()} available in ${data.source}`,
      );
    }

    const rows = await sql`
      INSERT INTO public.payouts (community_id, currency, source, amount, notes, status, requested_by)
      VALUES (${data.community_id}, ${data.currency}, ${data.source}, ${data.amount}, ${data.notes ?? null}, 'requested', ${context.userId}::uuid)
      RETURNING id
    `;
    return { id: rows[0].id };
  });

export const approvePayoutPaystack = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((i) => z.object({ payout_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);

    const payoutRows = await sql`
      SELECT id, community_id, amount, currency, status FROM public.payouts WHERE id = ${data.payout_id} LIMIT 1
    `;
    const payout = payoutRows[0];
    if (!payout) throw new Error("Payout not found");
    if (payout.status !== "requested") throw new Error("Payout is not pending");

    const communityRows = await sql`
      SELECT paystack_recipient_code, name FROM public.communities WHERE id = ${payout.community_id} LIMIT 1
    `;
    const community = communityRows[0];
    if (!community?.paystack_recipient_code) {
      throw new Error("Community has no Paystack recipient — use Mark as manually paid");
    }

    const tx = await initiateTransfer({
      amount: Number(payout.amount),
      recipient_code: community.paystack_recipient_code,
      reason: `Payout to ${community.name}`,
      currency: payout.currency as "NGN" | "USD",
    });

    await sql`
      UPDATE public.payouts
      SET status = 'approved',
          method = 'paystack_transfer',
          paystack_transfer_code = ${tx.transfer_code},
          paystack_transfer_ref = ${tx.reference},
          approved_by = ${context.userId}::uuid,
          approved_at = now()
      WHERE id = ${payout.id}
    `;

    return { transfer_code: tx.transfer_code };
  });

export const markPayoutPaid = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((i) =>
    z
      .object({
        payout_id: z.string().uuid(),
        note: z.string().max(500).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);

    await sql`
      UPDATE public.payouts
      SET status = 'paid',
          method = 'manual',
          approved_by = ${context.userId}::uuid,
          approved_at = now(),
          paid_at = now(),
          notes = ${data.note ?? null}
      WHERE id = ${data.payout_id} AND status IN ('requested', 'approved')
    `;
    return { ok: true };
  });

export const rejectPayout = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((i) =>
    z.object({ payout_id: z.string().uuid(), reason: z.string().max(500) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);

    await sql`
      UPDATE public.payouts
      SET status = 'rejected',
          failed_reason = ${data.reason},
          approved_by = ${context.userId}::uuid,
          approved_at = now()
      WHERE id = ${data.payout_id} AND status = 'requested'
    `;
    return { ok: true };
  });

// Super-admin-only listing that includes community bank details.
export const listPayoutRequests = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((i) => z.object({ pending_only: z.boolean().default(false) }).parse(i))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const rows = data.pending_only
      ? await sql`
          SELECT p.id, p.amount, p.currency, p.source, p.status, p.method, p.requested_at,
                 p.paid_at, p.notes, p.failed_reason, p.community_id,
                 json_build_object(
                   'name', c.name, 'bank_name', c.bank_name, 'account_number', c.account_number,
                   'account_name', c.account_name, 'paystack_recipient_code', c.paystack_recipient_code
                 ) AS community
          FROM public.payouts p
          JOIN public.communities c ON c.id = p.community_id
          WHERE p.status IN ('requested', 'approved')
          ORDER BY p.requested_at DESC
        `
      : await sql`
          SELECT p.id, p.amount, p.currency, p.source, p.status, p.method, p.requested_at,
                 p.paid_at, p.notes, p.failed_reason, p.community_id,
                 json_build_object(
                   'name', c.name, 'bank_name', c.bank_name, 'account_number', c.account_number,
                   'account_name', c.account_name, 'paystack_recipient_code', c.paystack_recipient_code
                 ) AS community
          FROM public.payouts p
          JOIN public.communities c ON c.id = p.community_id
          ORDER BY p.requested_at DESC
        `;
    return rows;
  });

// Community-admin view: balances by currency/source for one community.
export const getCommunityBalances = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((i) => z.object({ community_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertCommunityAdmin(context.userId, data.community_id);
    const rows = await sql`
      SELECT currency, source, collected, paid_out, pending_out, available
      FROM public.community_balances_by_source
      WHERE community_id = ${data.community_id}
    `;
    return rows;
  });

// Community-admin view: payout history for one community (no bank details).
export const listCommunityPayouts = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((i) => z.object({ community_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertCommunityAdmin(context.userId, data.community_id);
    const rows = await sql`
      SELECT id, amount, currency, source, status, method, requested_at, paid_at, notes, failed_reason
      FROM public.payouts
      WHERE community_id = ${data.community_id}
      ORDER BY requested_at DESC
    `;
    return rows;
  });
