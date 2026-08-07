import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { sql } from "@/lib/db/client";
import { requireAuth } from "@/lib/auth/require-auth.server";
import { FIELD_LIBRARY } from "@/lib/onboarding-fields";

// Shared by other server-function files that need to resolve "which
// community does this logged-in admin manage" without duplicating the
// user_roles lookup. Returns null if the user isn't a community_admin of
// any community (e.g. they're only a super_admin, or a plain member).
export async function communityIdForAdmin(userId: string): Promise<string | null> {
  const rows = await sql`
    SELECT community_id FROM public.user_roles
    WHERE user_id = ${userId}::uuid AND role = 'community_admin'
    ORDER BY created_at ASC
    LIMIT 1
  `;
  return (rows[0]?.community_id as string | undefined) ?? null;
}

// Public: the app is currently single-tenant in practice (one community per
// deployment), so the admin dashboard just grabs the first one ever created.
// Only public fields are returned — bank details go through getCommunityBank.
export const getDefaultCommunity = createServerFn({ method: "POST" }).handler(async () => {
  const rows = await sql`
    SELECT id, name
    FROM public.communities
    ORDER BY created_at ASC
    LIMIT 1
  `;
  return rows[0] ?? null;
});

// Public: looks up a community by its login-page slug (/l/{slug}) — powers
// the branded per-estate login page. Only non-sensitive fields.
export const getCommunityBySlug = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ slug: z.string().min(1).max(80) }).parse(i))
  .handler(async ({ data }) => {
    const rows = await sql`SELECT id, name, type FROM public.communities WHERE slug = ${data.slug} LIMIT 1`;
    const row = rows[0];
    if (!row) return null;
    return { id: row.id as string, name: row.name as string, type: (row.type as string | null) ?? "" };
  });

// The community the logged-in admin actually belongs to (as opposed to
// getDefaultCommunity's single-tenant "first ever" guess) — used by the
// admin shell/dashboard for the community name and trial countdown.
export const getMyCommunity = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const rows = await sql`
      SELECT c.id, c.name, c.slug, c.type, c.trial_ends_at, c.tier_id,
             t.name AS tier_name, t.monthly_price_ngn, t.monthly_price_usd,
             (SELECT paid_at FROM public.plan_payments
                WHERE community_id = c.id
                ORDER BY paid_at DESC LIMIT 1) AS last_payment_at
      FROM public.communities c
      JOIN public.user_roles ur ON ur.community_id = c.id
      LEFT JOIN public.subscription_tiers t ON t.id = c.tier_id
      WHERE ur.user_id = ${context.userId}::uuid
        AND ur.role = 'community_admin'
      ORDER BY c.created_at ASC
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) return null;

    const trialEndsAt = row.trial_ends_at as string | null;
    const onTrial = trialEndsAt != null;
    const trialDaysLeft = trialEndsAt
      ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
      : 0;

    // The app bills plans as one-time charges, not a recurring subscription
    // (no auto-charge, nothing gets cut off) — this is only an informational
    // "next renewal" estimate for the UI: one month on from the last actual
    // payment, so admins know when they'll need to pay again.
    const isPaidTier = Number(row.monthly_price_ngn ?? 0) > 0 || Number(row.monthly_price_usd ?? 0) > 0;
    const lastPaymentAt = row.last_payment_at as string | null;
    let renewsAt: string | null = null;
    let renewalDaysLeft: number | null = null;
    if (!onTrial && isPaidTier && lastPaymentAt) {
      const d = new Date(lastPaymentAt);
      d.setUTCMonth(d.getUTCMonth() + 1);
      renewsAt = d.toISOString();
      renewalDaysLeft = Math.ceil((d.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    }

    return {
      id: row.id as string,
      name: row.name as string,
      slug: row.slug as string,
      type: (row.type as string | null) ?? "",
      trialDaysLeft,
      onTrial,
      tierId: (row.tier_id as string | null) ?? null,
      tierName: (row.tier_name as string | null) ?? null,
      isPaidTier,
      renewsAt,
      renewalDaysLeft,
    };
  });

// Lets a community admin pick/change their subscription plan. Blocks
// switching to a plan whose member cap the community already exceeds, so
// "member limit" is a real constraint rather than a cosmetic number.
export const subscribeToPlan = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((i) => z.object({ tierId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const communityId = await communityIdForAdmin(context.userId);
    if (!communityId) throw new Error("You don't manage a community yet.");

    const tiers = await sql`SELECT id, active, max_members, monthly_price_ngn, monthly_price_usd FROM public.subscription_tiers WHERE id = ${data.tierId}::uuid`;
    const tier = tiers[0];
    if (!tier) throw new Error("Plan not found.");
    if (!tier.active) throw new Error("This plan is no longer available.");

    // This path assigns the tier immediately with no payment — only safe for
    // genuinely free plans. Paid plans must go through startPlanCheckout so
    // the tier is only granted once Paystack confirms payment (see the
    // webhook's "plan" branch), otherwise billing/revenue reporting (and the
    // community's actual access) would be wrong.
    const isFree = Number(tier.monthly_price_ngn ?? 0) === 0 && Number(tier.monthly_price_usd ?? 0) === 0;
    if (!isFree) throw new Error("This plan requires payment — use the checkout flow instead.");

    if (tier.max_members != null) {
      const countRows = await sql`SELECT count(*) AS n FROM public.members WHERE community_id = ${communityId}::uuid AND status = 'active'`;
      const current = Number(countRows[0]?.n ?? 0);
      if (current > Number(tier.max_members)) {
        throw new Error(`This plan allows up to ${tier.max_members} members — you currently have ${current} active. Remove some first or pick a bigger plan.`);
      }
    }

    await sql`UPDATE public.communities SET tier_id = ${data.tierId}::uuid, updated_at = now() WHERE id = ${communityId}::uuid`;
    return { ok: true };
  });

// Lets a community admin edit their own community's basic details after
// signup — previously these were write-once at signup with no way to fix a
// typo or a blank "type" from before this field was captured.
export const updateCommunityBasics = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((i) =>
    z
      .object({
        name: z.string().min(2).max(120),
        type: z.string().max(60).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const communityId = await communityIdForAdmin(context.userId);
    if (!communityId) throw new Error("You don't manage a community yet.");
    await sql`
      UPDATE public.communities
      SET name = ${data.name}, type = ${data.type || null}, updated_at = now()
      WHERE id = ${communityId}::uuid
    `;
    return { ok: true };
  });

// Real member counts + this month's birthday celebrants for the admin
// dashboard's overview tiles. Previously these tiles read from static
// mock-data, which is why "Active members" showed 0 regardless of real data.
export const getDashboardStats = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const communityId = await communityIdForAdmin(context.userId);
    if (!communityId) {
      return {
        activeMembers: 0,
        totalMembers: 0,
        birthdaysThisMonth: [] as { id: string; name: string; dob: string }[],
        messagesSent30d: 0,
      };
    }

    const counts = await sql`
      SELECT
        count(*) FILTER (WHERE status = 'active') AS active,
        count(*) AS total
      FROM public.members
      WHERE community_id = ${communityId}::uuid
    `;

    const birthdays = await sql`
      SELECT id, name, dob
      FROM public.members
      WHERE community_id = ${communityId}::uuid
        AND status = 'active'
        AND dob IS NOT NULL
        AND EXTRACT(MONTH FROM dob) = EXTRACT(MONTH FROM CURRENT_DATE)
      ORDER BY EXTRACT(DAY FROM dob) ASC
    `;

    // "Messages sent" = broadcast reach (each recipient counted) + individual
    // birthday emails, both in the trailing 30 days — gives a real sense of
    // outbound volume instead of the old static mock number.
    const messages = await sql`
      SELECT
        (SELECT COALESCE(SUM(reach), 0) FROM public.broadcasts
          WHERE community_id = ${communityId}::uuid AND sent_at >= now() - interval '30 days') AS broadcast_reach,
        (SELECT count(*) FROM public.members
          WHERE community_id = ${communityId}::uuid AND last_birthday_sent_at >= now() - interval '30 days') AS birthday_sends
    `;
    const messagesSent30d = Number(messages[0]?.broadcast_reach ?? 0) + Number(messages[0]?.birthday_sends ?? 0);

    return {
      activeMembers: Number(counts[0]?.active ?? 0),
      totalMembers: Number(counts[0]?.total ?? 0),
      birthdaysThisMonth: birthdays.map((r) => ({
        id: r.id as string,
        name: r.name as string,
        // String-sliced, not Date-parsed — see toDateString's note in
        // members.functions.ts: round-tripping a bare date through `new
        // Date()` can shift it by a day depending on local timezone.
        dob: String(r.dob).slice(0, 10),
      })),
      messagesSent30d,
    };
  });

// The onboarding form config for the logged-in admin's own community —
// which fields show up on their public join page.
export const getMyOnboardingFields = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const communityId = await communityIdForAdmin(context.userId);
    if (!communityId) return { communityId: null, fields: [] as string[] };
    const rows = await sql`SELECT onboarding_fields FROM public.communities WHERE id = ${communityId}::uuid`;
    const fields = (rows[0]?.onboarding_fields as string[] | undefined) ?? [];
    return { communityId, fields };
  });

export const saveOnboardingFields = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((i) => z.object({ fields: z.array(z.enum(FIELD_LIBRARY)) }).parse(i))
  .handler(async ({ data, context }) => {
    const communityId = await communityIdForAdmin(context.userId);
    if (!communityId) throw new Error("You don't manage a community yet.");
    await sql`
      UPDATE public.communities
      SET onboarding_fields = ${JSON.stringify(data.fields)}::jsonb, updated_at = now()
      WHERE id = ${communityId}::uuid
    `;
    return { ok: true };
  });
