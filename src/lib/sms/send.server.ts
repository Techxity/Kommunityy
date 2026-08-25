// The one send path all three channels funnel through. Gating, phone
// normalization, cost, balance, reserve-before-send, per-message logging, and
// refund-on-failure all live here so every channel behaves identically and a
// community can never be billed for SMS it didn't receive.
// See docs/sms-wallet-architecture.md §6.
import { sql } from "@/lib/db/client";
import { sendEmail } from "@/lib/email";
import { segmentInfo } from "./segments";
import { normalizeNgPhone } from "./phone";
import { getSmsSettings, getBalanceKobo, reserveFunds, refundFunds, type SmsSettings } from "./wallet.server";
import { termii } from "./termii.server";

export type SmsChannel = "birthday" | "reminder" | "broadcast" | "test";

export type SmsTarget = {
  memberId?: string | null;
  phone: string | null | undefined;
  optOut?: boolean;
  body: string;
};

export type SmsSendSummary = {
  attempted: boolean; // did we try to send (SMS on + channel on + sender set)?
  sent: number;
  failed: number;
  skipped: number; // no/invalid phone, opted out, or balance ran out
  costKobo: number;
  sentMemberIds: string[]; // members we successfully texted (for idempotency marking)
  reason?: string;
};

// Per-page rate in kobo, set to your Termii rate (pass-through). Env-driven so a
// price change is one line. Defaults are placeholders — set the real rate card.
function rateKobo(route: "dnd" | "generic"): number {
  const dnd = Number(process.env.SMS_RATE_DND_KOBO) || 400;
  const generic = Number(process.env.SMS_RATE_GENERIC_KOBO) || 300;
  return route === "dnd" ? dnd : generic;
}

function channelEnabled(settings: SmsSettings, channel: SmsChannel): boolean {
  switch (channel) {
    case "birthday":
      return settings.chBirthdays;
    case "reminder":
      return settings.chReminders;
    case "broadcast":
      return settings.chBroadcasts;
    case "test":
      return true; // a manual test only needs SMS enabled + a sender ID
  }
}

async function runPool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx]);
    }
  });
  await Promise.all(workers);
}

export async function sendCommunitySms(args: {
  communityId: string;
  channel: SmsChannel;
  targets: SmsTarget[];
  // `force` skips the per-channel automation toggle (chBirthdays/chReminders/…)
  // for an explicit admin-initiated send — SMS must still be enabled, have a
  // sender ID, and have wallet balance.
  force?: boolean;
}): Promise<SmsSendSummary> {
  const { communityId, channel, targets, force } = args;
  const settings = await getSmsSettings(communityId);

  const off = (reason: string): SmsSendSummary => ({ attempted: false, sent: 0, failed: 0, skipped: targets.length, costKobo: 0, sentMemberIds: [], reason });
  if (!settings.enabled) return off("SMS disabled");
  if (!force && !channelEnabled(settings, channel)) return off("channel off");
  if (!settings.senderId) return off("no sender ID set");

  const rate = rateKobo(settings.route);

  // Build the billable list; skip invalid numbers and opt-outs (never charged).
  type Prepared = { memberId: string | null; msisdn: string; body: string; pages: number; unicode: boolean; costKobo: number };
  const prepared: Prepared[] = [];
  let skipped = 0;
  for (const t of targets) {
    const msisdn = normalizeNgPhone(t.phone);
    if (!msisdn || t.optOut || !t.body.trim()) {
      skipped++;
      continue;
    }
    const seg = segmentInfo(t.body);
    prepared.push({
      memberId: t.memberId ?? null,
      msisdn,
      body: t.body,
      pages: seg.pages,
      unicode: seg.encoding === "unicode",
      costKobo: seg.pages * rate,
    });
  }
  if (prepared.length === 0) return { attempted: true, sent: 0, failed: 0, skipped, costKobo: 0, sentMemberIds: [], reason: "no valid recipients" };

  // Cover as many as the balance allows; the rest are skipped (they still get
  // the email the caller sends). Greedy in list order.
  const balance = await getBalanceKobo(communityId);
  const toSend: Prepared[] = [];
  let running = 0;
  for (const p of prepared) {
    if (running + p.costKobo <= balance) {
      toSend.push(p);
      running += p.costKobo;
    } else {
      skipped++;
    }
  }
  if (toSend.length === 0) {
    await maybeLowBalanceAlert(communityId);
    return { attempted: true, sent: 0, failed: 0, skipped, costKobo: 0, sentMemberIds: [], reason: "insufficient balance" };
  }

  // Reserve the whole cost up front (guarded debit). If a concurrent send raced
  // us below the balance, bail without sending.
  const batchRef = `sms:${channel}:${Date.now()}`;
  const reserved = await reserveFunds(communityId, running, batchRef, { channel, count: toSend.length });
  if (!reserved) {
    await maybeLowBalanceAlert(communityId);
    return { attempted: true, sent: 0, failed: 0, skipped: skipped + toSend.length, costKobo: 0, sentMemberIds: [], reason: "insufficient balance" };
  }

  let sent = 0;
  let failed = 0;
  let refundKobo = 0;
  const sentMemberIds: string[] = [];
  await runPool(toSend, 5, async (p) => {
    const res = await termii.sendOne({
      to: p.msisdn,
      from: settings.senderId as string,
      body: p.body,
      route: settings.route,
      unicode: p.unicode,
    });
    if (res.ok) {
      sent++;
      if (p.memberId) sentMemberIds.push(p.memberId);
    } else {
      failed++;
      refundKobo += p.costKobo;
    }
    await sql`
      INSERT INTO public.sms_messages
        (community_id, member_id, msisdn, channel, segments, cost_kobo, status, provider, provider_message_id, error)
      VALUES
        (${communityId}::uuid, ${p.memberId}, ${p.msisdn}, ${channel}, ${p.pages}, ${p.costKobo},
         ${res.ok ? "sent" : "failed"}, 'termii', ${res.messageId ?? null}, ${res.ok ? null : (res.error ?? "failed")})
    `;
  });

  // Refund the pages that failed at the provider — never bill for those.
  if (refundKobo > 0) {
    await refundFunds(communityId, refundKobo, batchRef, { channel, failed });
  }

  await maybeLowBalanceAlert(communityId);
  return { attempted: true, sent, failed, skipped, costKobo: running - refundKobo, sentMemberIds };
}

// Emails the admin once when the balance crosses below their threshold; resets
// when the balance recovers, so it re-arms for the next time.
async function maybeLowBalanceAlert(communityId: string): Promise<void> {
  try {
    const rows = await sql`
      SELECT low_balance_kobo, low_balance_alerted_at
      FROM public.community_sms_settings WHERE community_id = ${communityId}::uuid LIMIT 1
    `;
    if (rows.length === 0) return;
    const threshold = Number(rows[0].low_balance_kobo ?? 0);
    const alertedAt = rows[0].low_balance_alerted_at as string | null;
    const balance = await getBalanceKobo(communityId);

    if (balance > threshold) {
      if (alertedAt) {
        await sql`UPDATE public.community_sms_settings SET low_balance_alerted_at = NULL WHERE community_id = ${communityId}::uuid`;
      }
      return;
    }
    if (alertedAt) return; // already warned for this low period

    const info = await sql`
      SELECT c.name, u.email
      FROM public.communities c
      JOIN public.user_roles ur ON ur.community_id = c.id AND ur.role = 'community_admin'
      JOIN public.users u ON u.id = ur.user_id
      WHERE c.id = ${communityId}::uuid
      ORDER BY ur.created_at ASC LIMIT 1
    `;
    const email = info[0]?.email as string | undefined;
    const name = (info[0]?.name as string | undefined) ?? "your community";
    if (email) {
      await sendEmail({
        to: email,
        subject: `${name}: SMS balance is low`,
        fromName: name,
        html: `<p>Heads up — the SMS wallet for <strong>${name}</strong> has dropped to <strong>₦${(balance / 100).toLocaleString()}</strong>, below your alert threshold.</p><p>Top it up from the SMS page to keep birthday, reminder and broadcast texts going out.</p>`,
      });
    }
    await sql`UPDATE public.community_sms_settings SET low_balance_alerted_at = now() WHERE community_id = ${communityId}::uuid`;
  } catch (e: any) {
    console.error(`[sms low-balance alert] ${e?.message ?? "failed"}`);
  }
}
