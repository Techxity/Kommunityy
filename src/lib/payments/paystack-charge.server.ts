// Shared logic for turning a verified (status === "success") Paystack
// transaction into real data — payment record +, for plan payments, the
// actual tier grant. Called from two places that can each be the first to
// observe a successful charge:
//   1. The Paystack webhook (src/routes/api/public/paystack-webhook.ts) —
//      server-to-server, usually fast but not guaranteed to arrive quickly.
//   2. The paying admin's own browser landing back on /admin/subscription
//      right after checkout (src/lib/payments/tiers.functions.ts's
//      verifyPlanPayment) — instant, but the webhook may not have landed
//      yet, which is exactly what left the sidebar stuck locked.
// Whichever runs first wins; the payment insert is idempotent via
// ON CONFLICT DO NOTHING on (provider, provider_ref), and the community
// UPDATE is a no-op to re-run.
import { sql } from "@/lib/db/client";
import { sendEmail } from "@/lib/email";
import { paymentReceiptEmail } from "@/lib/email-templates";
import { monthsPerPeriod, parseYm, addMonths, formatYm } from "@/lib/dues-period";
import { toDateOnlyString } from "@/lib/date-only";

async function communityForDonation(donation_id: string) {
  const rows = await sql`SELECT community_id FROM public.donations WHERE id = ${donation_id} LIMIT 1`;
  return (rows[0]?.community_id as string | undefined) ?? null;
}
async function communityForDuesPlan(plan_id: string) {
  const rows = await sql`SELECT community_id FROM public.dues_plans WHERE id = ${plan_id} LIMIT 1`;
  return (rows[0]?.community_id as string | undefined) ?? null;
}

function moneyLabel(currency: "NGN" | "USD", amount: number): string {
  return `${currency === "NGN" ? "₦" : "$"}${amount.toLocaleString()}`;
}
// "Tue, 11 Aug 2026" — UTC, locale-independent (this runs server-side).
function receiptDate(): string {
  return new Date().toUTCString().slice(0, 16).trim();
}

// Emails a payment receipt. Deliberately best-effort: a receipt-send failure
// must never bubble up and fail the (already-completed) payment, so everything
// is wrapped and errors are only logged.
async function sendReceiptSafe(args: {
  to: string;
  recipientName: string;
  communityName: string;
  heading: string;
  amountLabel: string;
  reference: string;
  rows: { label: string; value: string }[];
}): Promise<void> {
  try {
    await sendEmail({
      to: args.to,
      subject: `Payment receipt — ${args.communityName}`,
      fromName: args.communityName,
      html: paymentReceiptEmail({
        recipientName: args.recipientName,
        communityName: args.communityName,
        heading: args.heading,
        amountLabel: args.amountLabel,
        reference: args.reference,
        paidOn: receiptDate(),
        rows: args.rows,
      }),
    });
  } catch (e: any) {
    console.error(`[receipt] ${e?.message ?? "send failed"}`);
  }
}

async function communityName(community_id: string | null): Promise<string> {
  if (!community_id) return "your community";
  const rows = await sql`SELECT name FROM public.communities WHERE id = ${community_id} LIMIT 1`;
  return (rows[0]?.name as string | undefined) ?? "your community";
}

// The calendar span a multi-period dues payment covers, e.g. "Aug 2026 – Oct 2026".
function coverageLabel(interval: string, months: number, periodStart: string | null): string | null {
  if (!periodStart) return null;
  const start = parseYm(toDateOnlyString(periodStart));
  const span = Math.max(1, months) * monthsPerPeriod(interval);
  if (span <= 1) return formatYm(start);
  const end = addMonths(start, span - 1);
  return `${formatYm(start)} – ${formatYm(end)}`;
}
export async function platformFeePctFor(community_id: string): Promise<number> {
  const rows = await sql`
    SELECT t.platform_fee_pct
    FROM public.communities c
    JOIN public.subscription_tiers t ON t.id = c.tier_id
    WHERE c.id = ${community_id}
    LIMIT 1
  `;
  const pct = rows[0]?.platform_fee_pct;
  return pct ? Number(pct) : 5; // sensible default
}

export type VerifiedPaystackTx = {
  status: string;
  reference: string;
  metadata?: Record<string, unknown> | null;
  currency: string;
  amount: number;
  fees?: number;
  customer?: { email?: string } | null;
};

export async function applyVerifiedCharge(
  tx: VerifiedPaystackTx,
): Promise<{ applied: boolean; kind?: "donation" | "dues" | "plan" }> {
  if (tx.status !== "success") return { applied: false };

  const meta = (tx.metadata ?? {}) as Record<string, any>;
  const reference = tx.reference;
  const currency = tx.currency as "NGN" | "USD";
  const gross = Number(tx.amount) / 100;
  const paystack_fee = Number(tx.fees ?? 0) / 100;
  const email = tx.customer?.email;

  let community_id: string | null = null;
  if (meta.kind === "donation" && meta.donation_id) {
    community_id = await communityForDonation(meta.donation_id);
  } else if (meta.kind === "dues" && meta.plan_id) {
    community_id = await communityForDuesPlan(meta.plan_id);
  }
  const pct = community_id ? await platformFeePctFor(community_id) : 5;
  const platform_fee = Math.round(gross * pct) / 100;
  const community_net = Math.max(0, gross - platform_fee);

  // Set by dues.functions.ts/donations.functions.ts at checkout time based on
  // whether a Paystack subaccount was passed to /transaction/initialize —
  // trusted here as-is since it only affects which pool a payment is counted
  // toward for manual payouts, not the amount collected or who was charged.
  const settlement_mode: "platform_held" | "subaccount_split" =
    meta.settlement_mode === "subaccount_split" ? "subaccount_split" : "platform_held";

  if (meta.kind === "donation" && meta.donation_id) {
    const payerName = (meta.payer_name as string | undefined) ?? email ?? "Anonymous";
    const inserted = await sql`
      INSERT INTO public.donation_payments
        (donation_id, payer_name, payer_email, amount, currency, provider, provider_ref, status, paystack_fee, platform_fee, community_net, settlement_mode)
      VALUES
        (${meta.donation_id}, ${payerName}, ${email ?? null}, ${gross}, ${currency}, 'paystack', ${reference}, 'paid', ${paystack_fee}, ${platform_fee}, ${community_net}, ${settlement_mode})
      ON CONFLICT (provider, provider_ref) DO NOTHING
      RETURNING id
    `;
    // Only on a genuinely new insert (not a webhook/browser duplicate) and only
    // if we have somewhere to send it.
    if (inserted.length > 0 && email) {
      const purposeRows = await sql`SELECT purpose FROM public.donations WHERE id = ${meta.donation_id} LIMIT 1`;
      const purpose = (purposeRows[0]?.purpose as string | undefined) ?? "Donation";
      const cName = await communityName(community_id);
      await sendReceiptSafe({
        to: email,
        recipientName: payerName,
        communityName: cName,
        heading: `Thank you for your donation to ${cName}`,
        amountLabel: moneyLabel(currency, gross),
        reference,
        rows: [
          { label: "Paid to", value: cName },
          { label: "For", value: purpose },
        ],
      });
    }
    return { applied: true, kind: "donation" };
  }

  if (meta.kind === "dues" && meta.plan_id) {
    // Multi-month dues: how many periods this covers and which period it
    // starts from — set by startDuesCheckout, used to compute what the member
    // is paid through. Default to a single current-ish period for safety.
    const months = Number.isFinite(Number(meta.months)) && Number(meta.months) > 0 ? Math.min(12, Math.floor(Number(meta.months))) : 1;
    const period_start: string | null =
      typeof meta.period_start === "string" && /^\d{4}-\d{2}-\d{2}$/.test(meta.period_start) ? meta.period_start : null;
    const memberName = (meta.member_name as string | undefined) ?? email ?? "Member";
    const inserted = await sql`
      INSERT INTO public.dues_payments
        (plan_id, member_name, member_email, amount, currency, provider, provider_ref, status, paystack_fee, platform_fee, community_net, settlement_mode, months, period_start)
      VALUES
        (${meta.plan_id}, ${memberName}, ${email ?? null}, ${gross}, ${currency}, 'paystack', ${reference}, 'paid', ${paystack_fee}, ${platform_fee}, ${community_net}, ${settlement_mode}, ${months}, ${period_start}::date)
      ON CONFLICT (provider, provider_ref) DO NOTHING
      RETURNING id
    `;
    if (inserted.length > 0 && email) {
      const planRows = await sql`SELECT name, interval FROM public.dues_plans WHERE id = ${meta.plan_id} LIMIT 1`;
      const planName = (planRows[0]?.name as string | undefined) ?? "Membership dues";
      const interval = (planRows[0]?.interval as string | undefined) ?? "monthly";
      const cName = await communityName(community_id);
      const coverage = coverageLabel(interval, months, period_start);
      const rows = [
        { label: "Paid to", value: cName },
        { label: "For", value: planName },
      ];
      if (coverage) rows.push({ label: "Period covered", value: coverage });
      await sendReceiptSafe({
        to: email,
        recipientName: memberName,
        communityName: cName,
        heading: `Your dues payment to ${cName}`,
        amountLabel: moneyLabel(currency, gross),
        reference,
        rows,
      });
    }
    return { applied: true, kind: "dues" };
  }

  if (meta.kind === "plan" && meta.community_id && meta.tier_id) {
    const periodMonths = Number(meta.period_months) === 12 ? 12 : 1;
    await sql`
      INSERT INTO public.plan_payments
        (community_id, tier_id, amount, currency, provider, provider_ref, status, period_months)
      VALUES
        (${meta.community_id}, ${meta.tier_id}, ${gross}, ${currency}, 'paystack', ${reference}, 'paid', ${periodMonths})
      ON CONFLICT (provider, provider_ref) DO NOTHING
    `;
    await sql`
      UPDATE public.communities
      SET tier_id = ${meta.tier_id}, trial_ends_at = NULL, suspended = false, updated_at = now()
      WHERE id = ${meta.community_id}
    `;
    return { applied: true, kind: "plan" };
  }

  return { applied: false };
}
