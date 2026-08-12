import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRequestHost } from "@tanstack/react-start/server";
import { sql } from "@/lib/db/client";
import { initializeTransaction } from "./paystack.server";
import { requireAuth } from "@/lib/auth/require-auth.server";
import { errorBoundary } from "@/lib/error-boundary.server";
import { communityIdForAdmin } from "./communities.functions";

function slugify(text: string): string {
  const base = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-+|-+$)/g, "").slice(0, 60);
  const suffix = crypto.randomUUID().slice(0, 6);
  return `${base || "fund"}-${suffix}`;
}

const StartDonationInput = z.object({
  slug: z.string().min(1).max(128),
  currency: z.enum(["NGN", "USD"]),
  amount: z.number().positive().max(100_000_000),
  payer_name: z.string().min(1).max(120),
  payer_email: z.string().email().max(200),
});

export const startDonationCheckout = createServerFn({ method: "POST" })
  .middleware([errorBoundary])
  .inputValidator((input) => StartDonationInput.parse(input))
  .handler(async ({ data }) => {
    const rows = await sql`
      SELECT d.id, d.purpose, d.status, d.target_ngn, d.target_usd, d.shareable_slug,
        c.paystack_subaccount_code
      FROM public.donations d
      JOIN public.communities c ON c.id = d.community_id
      WHERE d.shareable_slug = ${data.slug}
      LIMIT 1
    `;
    const donation = rows[0];
    if (!donation) throw new Error("Donation not found");
    if (donation.status !== "active") throw new Error("Donation is closed");
    if (data.currency === "NGN" && !donation.target_ngn) throw new Error("NGN not accepted");
    if (data.currency === "USD" && !donation.target_usd) throw new Error("USD not accepted");

    const host = getRequestHost();
    const proto = host.includes("localhost") ? "http" : "https";
    const callback_url = `${proto}://${host}/donate/${data.slug}?status=success`;

    // Subaccounts are an NGN-rails feature — USD always stays on the
    // platform-held/manual-payout path regardless of whether one exists.
    const subaccount_code = data.currency === "NGN" ? (donation.paystack_subaccount_code as string | null) : null;
    const settlement_mode = subaccount_code ? "subaccount_split" : "platform_held";

    const tx = await initializeTransaction({
      email: data.payer_email,
      amount: data.amount,
      currency: data.currency,
      callback_url,
      subaccount: subaccount_code ?? undefined,
      metadata: {
        kind: "donation",
        donation_id: donation.id,
        payer_name: data.payer_name,
        settlement_mode,
      },
    });

    return { authorization_url: tx.authorization_url, reference: tx.reference };
  });

// ── Admin: donation campaigns ────────────────────────────────────────────

export const listMyDonations = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const communityId = await communityIdForAdmin(context.userId, context.activeCommunityId);
    if (!communityId) return [];
    const rows = await sql`
      SELECT
        d.id, d.purpose, d.target_ngn, d.target_usd, d.deadline, d.status, d.shareable_slug,
        COALESCE(t.collected_ngn, 0) AS collected_ngn,
        COALESCE(t.collected_usd, 0) AS collected_usd
      FROM public.donations d
      LEFT JOIN public.donation_totals t ON t.donation_id = d.id
      WHERE d.community_id = ${communityId}::uuid
      ORDER BY d.created_at DESC
    `;
    return rows.map((r) => ({
      id: r.id as string,
      purpose: r.purpose as string,
      targetNgn: r.target_ngn != null ? Number(r.target_ngn) : 0,
      targetUsd: r.target_usd != null ? Number(r.target_usd) : 0,
      collectedNgn: Number(r.collected_ngn),
      collectedUsd: Number(r.collected_usd),
      deadline: r.deadline ? new Date(r.deadline as string).toISOString().slice(0, 10) : "",
      status: r.status as "active" | "closed",
      slug: r.shareable_slug as string,
    }));
  });

export const createDonation = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((i) =>
    z
      .object({
        purpose: z.string().min(1).max(200),
        targetNgn: z.number().positive().nullable().optional(),
        targetUsd: z.number().positive().nullable().optional(),
        deadline: z.string().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    if (!data.targetNgn && !data.targetUsd) throw new Error("Set a target in at least one currency.");
    const communityId = await communityIdForAdmin(context.userId, context.activeCommunityId);
    if (!communityId) throw new Error("You don't manage a community yet.");
    const slug = slugify(data.purpose);
    await sql`
      INSERT INTO public.donations (community_id, purpose, target_ngn, target_usd, deadline, shareable_slug)
      VALUES (${communityId}::uuid, ${data.purpose}, ${data.targetNgn ?? null}, ${data.targetUsd ?? null}, ${data.deadline || null}::date, ${slug})
    `;
    return { ok: true };
  });

export const updateDonation = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((i) =>
    z
      .object({
        id: z.string().uuid(),
        purpose: z.string().min(1).max(200),
        targetNgn: z.number().positive().nullable().optional(),
        targetUsd: z.number().positive().nullable().optional(),
        deadline: z.string().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    if (!data.targetNgn && !data.targetUsd) throw new Error("Set a target in at least one currency.");
    const communityId = await communityIdForAdmin(context.userId, context.activeCommunityId);
    if (!communityId) throw new Error("You don't manage a community yet.");
    await sql`
      UPDATE public.donations
      SET purpose = ${data.purpose}, target_ngn = ${data.targetNgn ?? null}, target_usd = ${data.targetUsd ?? null},
          deadline = ${data.deadline || null}::date, updated_at = now()
      WHERE id = ${data.id}::uuid AND community_id = ${communityId}::uuid
    `;
    return { ok: true };
  });

export const endDonation = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const communityId = await communityIdForAdmin(context.userId, context.activeCommunityId);
    if (!communityId) throw new Error("You don't manage a community yet.");
    await sql`
      UPDATE public.donations SET status = 'closed', updated_at = now()
      WHERE id = ${data.id}::uuid AND community_id = ${communityId}::uuid
    `;
    return { ok: true };
  });

export const listDonationPayers = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((i) => z.object({ donationId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const communityId = await communityIdForAdmin(context.userId, context.activeCommunityId);
    if (!communityId) return [];
    const rows = await sql`
      SELECT dp.payer_name, dp.amount, dp.currency, dp.paid_at
      FROM public.donation_payments dp
      JOIN public.donations d ON d.id = dp.donation_id
      WHERE dp.donation_id = ${data.donationId}::uuid AND d.community_id = ${communityId}::uuid AND dp.status = 'paid'
      ORDER BY dp.paid_at DESC
    `;
    return rows.map((r) => ({
      member: r.payer_name as string,
      amount: Number(r.amount),
      currency: r.currency as "NGN" | "USD",
      date: new Date(r.paid_at as string).toLocaleDateString(),
    }));
  });

// Public: a donation campaign's share page — details + aggregate totals only
// (individual donor rows stay admin-only, see listDonationPayments).
export const getDonationBySlug = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ slug: z.string().min(1).max(128) }).parse(i))
  .handler(async ({ data }) => {
    const rows = await sql`
      SELECT id, purpose, status, target_ngn, target_usd, deadline, shareable_slug
      FROM public.donations
      WHERE shareable_slug = ${data.slug}
      LIMIT 1
    `;
    const donation = rows[0];
    if (!donation) return null;

    const totalsRows = await sql`
      SELECT collected_ngn, collected_usd
      FROM public.donation_totals
      WHERE donation_id = ${donation.id}
      LIMIT 1
    `;
    const totals = totalsRows[0];
    return {
      donation,
      collected_ngn: Number(totals?.collected_ngn ?? 0),
      collected_usd: Number(totals?.collected_usd ?? 0),
    };
  });
