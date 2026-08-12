import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { sql } from "@/lib/db/client";
import { requireAuth } from "@/lib/auth/require-auth.server";
import { assertSuperAdmin } from "./authz";
import { communityIdForAdmin } from "./communities.functions";
import { initializeTransaction, verifyTransaction } from "./paystack.server";
import { applyVerifiedCharge } from "./paystack-charge.server";

// Wrapped for the same reason as invites.functions.ts's getOrigin — this
// file is reachable from the client via `.middleware([requireAuth])`, so
// any direct `@tanstack/react-start/server` usage needs the compiler's
// createServerOnlyFn transform to get stripped from the client bundle.
const getOrigin = createServerOnlyFn((): string => new URL(getRequest().url).origin);

// Public: subscription tiers are shown on the pricing page, and read by the
// super-admin fees page (which needs every tier, active or not).
export const listSubscriptionTiers = createServerFn({ method: "POST" }).handler(async () => {
  const rows = await sql`
    SELECT id, name, platform_fee_pct, monthly_price_ngn, monthly_price_usd, max_members, modules, active
    FROM public.subscription_tiers
    ORDER BY sort_order ASC
  `;
  return rows.map((r) => ({
    id: r.id as string,
    name: r.name as string,
    platform_fee_pct: Number(r.platform_fee_pct),
    monthly_price_ngn: Number(r.monthly_price_ngn ?? 0),
    monthly_price_usd: Number(r.monthly_price_usd ?? 0),
    maxMembers: r.max_members != null ? Number(r.max_members) : null,
    modules: (r.modules as string[] | null) ?? [],
    active: r.active as boolean,
  }));
});

// Super-admin only: editing the platform fee percentage.
export const updateTierFee = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((i) =>
    z
      .object({
        tier_id: z.string().uuid(),
        platform_fee_pct: z.number().min(0).max(100),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    await sql`
      UPDATE public.subscription_tiers
      SET platform_fee_pct = ${data.platform_fee_pct}, updated_at = now()
      WHERE id = ${data.tier_id}
    `;
    return { ok: true };
  });

// ── Trial settings (platform-wide singleton) ─────────────────────────────

// Public: read by the signup page to decide whether to offer a free trial
// option and what it includes.
export const getTrialSettings = createServerFn({ method: "POST" }).handler(async () => {
  const rows = await sql`
    SELECT s.trial_enabled, s.trial_days, s.require_card, s.trial_tier_id, t.name AS trial_tier_name
    FROM public.platform_settings s
    LEFT JOIN public.subscription_tiers t ON t.id = s.trial_tier_id
    WHERE s.id = true
  `;
  const row = rows[0];
  if (!row) return { enabled: false, days: 14, requireCard: false, tierId: null as string | null, tierName: null as string | null };
  return {
    enabled: row.trial_enabled as boolean,
    days: Number(row.trial_days),
    requireCard: row.require_card as boolean,
    tierId: (row.trial_tier_id as string | null) ?? null,
    tierName: (row.trial_tier_name as string | null) ?? null,
  };
});

export const updateTrialSettings = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((i) =>
    z
      .object({
        enabled: z.boolean(),
        days: z.number().int().min(1).max(180),
        tierId: z.string().uuid().nullable(),
        requireCard: z.boolean(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    await sql`
      UPDATE public.platform_settings
      SET trial_enabled = ${data.enabled}, trial_days = ${data.days}, trial_tier_id = ${data.tierId}, require_card = ${data.requireCard}, updated_at = now()
      WHERE id = true
    `;
    return { ok: true };
  });

// ── Super admin: plans & modules ─────────────────────────────────────────

export const listPlansForSuperAdmin = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.userId);
    const rows = await sql`
      SELECT
        t.id, t.name, t.monthly_price_ngn, t.monthly_price_usd, t.max_members, t.modules, t.active,
        COALESCE(c.count, 0) AS active_subscriptions
      FROM public.subscription_tiers t
      LEFT JOIN LATERAL (
        SELECT count(*) AS count FROM public.communities WHERE tier_id = t.id
      ) c ON true
      ORDER BY t.sort_order ASC
    `;
    return rows.map((r) => ({
      id: r.id as string,
      name: r.name as string,
      priceNgn: Number(r.monthly_price_ngn ?? 0),
      priceUsd: Number(r.monthly_price_usd ?? 0),
      maxMembers: r.max_members != null ? Number(r.max_members) : null,
      modules: (r.modules as string[] | null) ?? [],
      active: r.active as boolean,
      activeSubscriptions: Number(r.active_subscriptions),
    }));
  });

const planFields = {
  name: z.string().min(1).max(80),
  priceNgn: z.number().min(0),
  priceUsd: z.number().min(0),
  maxMembers: z.number().int().positive().nullable(),
  modules: z.array(z.string()).default([]),
};

export const createPlan = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((i) => z.object(planFields).parse(i))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const existing = await sql`SELECT id FROM public.subscription_tiers WHERE lower(name) = lower(${data.name})`;
    if (existing[0]) throw new Error("A plan with this name already exists.");
    const sortRows = await sql`SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM public.subscription_tiers`;
    await sql`
      INSERT INTO public.subscription_tiers (name, monthly_price_ngn, monthly_price_usd, max_members, modules, sort_order, active)
      VALUES (${data.name}, ${data.priceNgn}, ${data.priceUsd}, ${data.maxMembers}, ${JSON.stringify(data.modules)}::jsonb, ${sortRows[0].next}, true)
    `;
    return { ok: true };
  });

export const updatePlan = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid(), ...planFields }).parse(i))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const existing = await sql`SELECT id FROM public.subscription_tiers WHERE lower(name) = lower(${data.name}) AND id <> ${data.id}::uuid`;
    if (existing[0]) throw new Error("A plan with this name already exists.");
    await sql`
      UPDATE public.subscription_tiers
      SET name = ${data.name}, monthly_price_ngn = ${data.priceNgn}, monthly_price_usd = ${data.priceUsd},
          max_members = ${data.maxMembers}, modules = ${JSON.stringify(data.modules)}::jsonb, updated_at = now()
      WHERE id = ${data.id}::uuid
    `;
    return { ok: true };
  });

// Enabling a plan is always safe. Disabling one that still has communities on
// it requires a target plan to move them to first — set moveCommunitiesToTierId
// once the caller has picked one, or this returns needsReassignment so the UI
// can prompt for it.
export const setPlanActive = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((i) =>
    z
      .object({
        id: z.string().uuid(),
        active: z.boolean(),
        moveCommunitiesToTierId: z.string().uuid().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);

    if (data.active) {
      await sql`UPDATE public.subscription_tiers SET active = true, updated_at = now() WHERE id = ${data.id}::uuid`;
      return { ok: true };
    }

    const countRows = await sql`SELECT count(*) AS n FROM public.communities WHERE tier_id = ${data.id}::uuid`;
    const affected = Number(countRows[0]?.n ?? 0);

    if (affected > 0) {
      if (!data.moveCommunitiesToTierId) {
        return { ok: false, needsReassignment: true, affectedCount: affected };
      }
      if (data.moveCommunitiesToTierId === data.id) {
        throw new Error("Pick a different plan to move communities to.");
      }
      const target = await sql`SELECT id, active FROM public.subscription_tiers WHERE id = ${data.moveCommunitiesToTierId}::uuid`;
      if (!target[0]) throw new Error("Target plan not found.");
      if (!target[0].active) throw new Error("Can't move communities to a disabled plan.");

      await sql`UPDATE public.communities SET tier_id = ${data.moveCommunitiesToTierId}::uuid WHERE tier_id = ${data.id}::uuid`;
    }

    await sql`UPDATE public.subscription_tiers SET active = false, updated_at = now() WHERE id = ${data.id}::uuid`;
    return { ok: true, movedCount: affected };
  });

// ── Super admin: module catalog ──────────────────────────────────────────

export const listModuleCatalog = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.userId);
    const rows = await sql`SELECT name FROM public.platform_modules ORDER BY sort_order ASC, name ASC`;
    return rows.map((r) => r.name as string);
  });

export const addModuleToCatalog = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((i) => z.object({ name: z.string().min(1).max(60) }).parse(i))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const sortRows = await sql`SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM public.platform_modules`;
    await sql`
      INSERT INTO public.platform_modules (name, sort_order) VALUES (${data.name}, ${sortRows[0].next})
      ON CONFLICT (name) DO NOTHING
    `;
    return { ok: true };
  });

// Removes a module from the catalog AND strips it out of every plan that
// had it enabled — matches the old prototype's behavior.
export const removeModuleFromCatalog = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((i) => z.object({ name: z.string().min(1).max(60) }).parse(i))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    await sql`DELETE FROM public.platform_modules WHERE name = ${data.name}`;
    await sql`
      UPDATE public.subscription_tiers
      SET modules = (modules - ${data.name}), updated_at = now()
      WHERE modules @> to_jsonb(${data.name}::text)
    `;
    return { ok: true };
  });

// ── Community admin: paying for a plan ───────────────────────────────────

// Starts a real Paystack checkout for the community's chosen plan. The plan
// is NOT applied yet — that only happens once the paystack-webhook confirms
// charge.success (see src/routes/api/public/paystack-webhook.ts), so an
// abandoned checkout never grants access for free.
export const startPlanCheckout = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((i) => z.object({ tierId: z.string().uuid(), currency: z.enum(["NGN", "USD"]) }).parse(i))
  .handler(async ({ data, context }) => {
    const communityId = await communityIdForAdmin(context.userId, context.activeCommunityId);
    if (!communityId) throw new Error("You don't manage a community yet.");

    const tiers = await sql`SELECT id, name, monthly_price_ngn, monthly_price_usd, active FROM public.subscription_tiers WHERE id = ${data.tierId}::uuid`;
    const tier = tiers[0];
    if (!tier) throw new Error("Plan not found.");
    if (!tier.active) throw new Error("This plan is no longer available.");

    const amount = data.currency === "NGN" ? Number(tier.monthly_price_ngn) : Number(tier.monthly_price_usd);
    if (!amount) throw new Error(`${tier.name} isn't priced in ${data.currency}.`);

    const userRows = await sql`SELECT email FROM public.users WHERE id = ${context.userId}::uuid`;
    const email = (userRows[0]?.email as string | undefined) ?? "";

    const origin = getOrigin();
    const callback_url = `${origin}/admin/subscription`;

    const tx = await initializeTransaction({
      email,
      amount,
      currency: data.currency,
      callback_url,
      metadata: { kind: "plan", community_id: communityId, tier_id: data.tierId },
    });

    return { authorization_url: tx.authorization_url, reference: tx.reference };
  });

// Lets the admin's own browser confirm a checkout as soon as it lands back
// on /admin/subscription, instead of only relying on the Paystack webhook —
// the webhook is usually fast but runs async and isn't guaranteed to beat
// the browser's redirect back here, which is exactly what could leave the
// sidebar showing locked modules even though payment succeeded. Safe to
// call more than once: applyVerifiedCharge is idempotent.
export const verifyPlanPayment = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((i) => z.object({ reference: z.string().min(1) }).parse(i))
  .handler(async ({ data, context }) => {
    const communityId = await communityIdForAdmin(context.userId, context.activeCommunityId);
    if (!communityId) throw new Error("You don't manage a community yet.");

    const tx = await verifyTransaction(data.reference);
    const meta = (tx.metadata ?? {}) as Record<string, any>;
    if (meta.kind !== "plan" || meta.community_id !== communityId) {
      throw new Error("This payment reference doesn't belong to your community.");
    }

    const result = await applyVerifiedCharge(tx);
    return { ok: result.applied, status: tx.status as string };
  });

// The modules the admin's community is actually entitled to right now —
// drives both the sidebar's locked/unlocked state and each gated route's
// beforeLoad check.
export const getMyModules = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const communityId = await communityIdForAdmin(context.userId, context.activeCommunityId);
    if (!communityId) return [] as string[];
    const rows = await sql`
      SELECT t.modules
      FROM public.communities c
      JOIN public.subscription_tiers t ON t.id = c.tier_id
      WHERE c.id = ${communityId}::uuid
    `;
    return (rows[0]?.modules as string[] | undefined) ?? [];
  });
