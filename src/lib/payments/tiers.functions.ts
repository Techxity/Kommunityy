import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { sql } from "@/lib/db/client";
import { requireAuth } from "@/lib/auth/require-auth.server";
import { assertSuperAdmin } from "./authz";

// Public: subscription tiers are shown on the pricing page.
export const listSubscriptionTiers = createServerFn({ method: "POST" }).handler(async () => {
  const rows = await sql`
    SELECT id, name, platform_fee_pct, monthly_price_ngn, monthly_price_usd
    FROM public.subscription_tiers
    ORDER BY sort_order ASC
  `;
  return rows;
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
