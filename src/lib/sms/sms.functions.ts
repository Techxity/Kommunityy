// Admin-facing SMS wallet server functions: read the wallet + settings, save
// settings, start/verify a Paystack top-up, and read the statement. The wallet
// is entirely community-owned — no super-admin needed for day-to-day use.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRequestHost } from "@tanstack/react-start/server";
import { sql } from "@/lib/db/client";
import { requireAuth } from "@/lib/auth/require-auth.server";
import { errorBoundary } from "@/lib/error-boundary.server";
import { communityIdForAdmin } from "@/lib/payments/communities.functions";
import { initializeTransaction, verifyTransaction } from "@/lib/payments/paystack.server";
import { applyVerifiedCharge } from "@/lib/payments/paystack-charge.server";
import { getSmsSettings, getBalanceKobo } from "./wallet.server";
import { grossUpNgn } from "./paystack-fee";

// Snapshot for the SMS admin page: settings, balance, and recent activity.
export const getSmsOverview = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const communityId = await communityIdForAdmin(context.userId, context.activeCommunityId);
    if (!communityId) return null;

    const settings = await getSmsSettings(communityId);
    const balanceKobo = await getBalanceKobo(communityId);

    const ledger = await sql`
      SELECT delta_kobo, kind, reference, created_at
      FROM public.sms_ledger WHERE community_id = ${communityId}::uuid
      ORDER BY created_at DESC LIMIT 25
    `;
    const messages = await sql`
      SELECT channel, msisdn, segments, cost_kobo, status, created_at
      FROM public.sms_messages WHERE community_id = ${communityId}::uuid
      ORDER BY created_at DESC LIMIT 25
    `;
    // Spend + count this calendar month.
    const stats = await sql`
      SELECT
        COALESCE(-SUM(delta_kobo) FILTER (WHERE kind = 'debit' AND created_at >= date_trunc('month', now())), 0) AS spent_month_kobo,
        (SELECT COUNT(*) FROM public.sms_messages
          WHERE community_id = ${communityId}::uuid AND status <> 'failed'
            AND created_at >= date_trunc('month', now())) AS sent_month
      FROM public.sms_ledger WHERE community_id = ${communityId}::uuid
    `;

    return {
      settings,
      balanceKobo,
      spentMonthKobo: Number(stats[0]?.spent_month_kobo ?? 0),
      sentMonth: Number(stats[0]?.sent_month ?? 0),
      ledger: ledger.map((r) => ({
        deltaKobo: Number(r.delta_kobo),
        kind: r.kind as string,
        reference: (r.reference as string | null) ?? null,
        at: new Date(r.created_at as string).toLocaleString(),
      })),
      messages: messages.map((r) => ({
        channel: r.channel as string,
        msisdn: r.msisdn as string,
        segments: Number(r.segments),
        costKobo: Number(r.cost_kobo),
        status: r.status as string,
        at: new Date(r.created_at as string).toLocaleString(),
      })),
    };
  });

export const saveSmsSettings = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((i) =>
    z
      .object({
        enabled: z.boolean(),
        senderId: z.string().max(11).optional().nullable(),
        route: z.enum(["dnd", "generic"]),
        chBirthdays: z.boolean(),
        chReminders: z.boolean(),
        chBroadcasts: z.boolean(),
        lowBalanceNgn: z.number().int().min(0).max(1000000),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const communityId = await communityIdForAdmin(context.userId, context.activeCommunityId);
    if (!communityId) throw new Error("You don't manage a community yet.");
    // A 3–11 char alphanumeric sender ID is required to actually send; allow
    // saving a blank one (SMS just can't send until it's set + approved).
    const senderId = data.senderId?.trim() || null;
    await sql`
      INSERT INTO public.community_sms_settings
        (community_id, enabled, sender_id, route, ch_birthdays, ch_reminders, ch_broadcasts, low_balance_kobo, updated_at)
      VALUES
        (${communityId}::uuid, ${data.enabled}, ${senderId}, ${data.route}, ${data.chBirthdays}, ${data.chReminders}, ${data.chBroadcasts}, ${data.lowBalanceNgn * 100}, now())
      ON CONFLICT (community_id) DO UPDATE SET
        enabled = EXCLUDED.enabled,
        sender_id = EXCLUDED.sender_id,
        route = EXCLUDED.route,
        ch_birthdays = EXCLUDED.ch_birthdays,
        ch_reminders = EXCLUDED.ch_reminders,
        ch_broadcasts = EXCLUDED.ch_broadcasts,
        low_balance_kobo = EXCLUDED.low_balance_kobo,
        updated_at = now()
    `;
    return { ok: true };
  });

// Starts a Paystack checkout to top up the SMS wallet. The community is credited
// the full amount they chose; the Paystack fee is added on top of the charge, so
// `topup_amount_kobo` (the intended credit) travels in metadata and is what the
// webhook/verify actually credits — not the grossed-up amount charged.
export const startSmsTopup = createServerFn({ method: "POST" })
  .middleware([errorBoundary, requireAuth])
  .inputValidator((i) => z.object({ amountNgn: z.number().int().min(100).max(500000) }).parse(i))
  .handler(async ({ data, context }) => {
    const communityId = await communityIdForAdmin(context.userId, context.activeCommunityId);
    if (!communityId) throw new Error("You don't manage a community yet.");

    const rows = await sql`
      SELECT c.name, u.email
      FROM public.communities c
      JOIN public.user_roles ur ON ur.community_id = c.id AND ur.role = 'community_admin'
      JOIN public.users u ON u.id = ur.user_id
      WHERE c.id = ${communityId}::uuid
      ORDER BY ur.created_at ASC LIMIT 1
    `;
    const email = (rows[0]?.email as string | undefined) ?? undefined;
    if (!email) throw new Error("No admin email on file to bill the top-up to.");

    const grossNgn = grossUpNgn(data.amountNgn);
    const host = getRequestHost();
    const proto = host.includes("localhost") ? "http" : "https";
    const callback_url = `${proto}://${host}/admin/sms?topup=success`;

    const tx = await initializeTransaction({
      email,
      amount: grossNgn,
      currency: "NGN",
      callback_url,
      metadata: {
        kind: "sms_topup",
        community_id: communityId,
        topup_amount_kobo: data.amountNgn * 100,
      },
    });
    return { authorization_url: tx.authorization_url, reference: tx.reference, grossNgn };
  });

// Confirms a just-completed top-up when the admin's browser lands back on the
// SMS page. Idempotent via applyVerifiedCharge (webhook is the other caller).
export const verifySmsTopup = createServerFn({ method: "POST" })
  .middleware([errorBoundary, requireAuth])
  .inputValidator((i) => z.object({ reference: z.string().min(1) }).parse(i))
  .handler(async ({ data }) => {
    const tx = await verifyTransaction(data.reference);
    const meta = (tx.metadata ?? {}) as Record<string, any>;
    if (meta.kind !== "sms_topup") throw new Error("This reference isn't an SMS top-up.");
    const result = await applyVerifiedCharge(tx);
    return { ok: result.applied, status: tx.status as string };
  });
