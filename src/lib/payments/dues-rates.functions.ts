// Named dues rates ("2-bed flat ₦500,000", "Student ₦2,000") a community assigns
// to its members. A member's price = custom amount → rate → plan default; see
// resolveMemberPrice in src/lib/dues-arrears.ts.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { sql } from "@/lib/db/client";
import { requireAuth } from "@/lib/auth/require-auth.server";
import { communityIdForAdmin } from "./communities.functions";

export const listDuesRates = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const communityId = await communityIdForAdmin(context.userId, context.activeCommunityId);
    if (!communityId) return [];
    const rows = await sql`
      SELECT r.id, r.name, r.amount_ngn, r.amount_usd, COUNT(m.id) AS member_count
      FROM public.dues_rates r
      LEFT JOIN public.members m ON m.dues_rate_id = r.id AND m.status = 'active'
      WHERE r.community_id = ${communityId}::uuid
      GROUP BY r.id
      ORDER BY r.name ASC
    `;
    return rows.map((r) => ({
      id: r.id as string,
      name: r.name as string,
      amountNgn: r.amount_ngn != null ? Number(r.amount_ngn) : null,
      amountUsd: r.amount_usd != null ? Number(r.amount_usd) : null,
      memberCount: Number(r.member_count ?? 0),
    }));
  });

export const saveDuesRate = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((i) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().trim().min(1).max(120),
        amountNgn: z.number().positive().max(1_000_000_000).nullable().optional(),
        amountUsd: z.number().positive().max(1_000_000_000).nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    if (!data.amountNgn && !data.amountUsd) throw new Error("Set an amount in at least one currency.");
    const communityId = await communityIdForAdmin(context.userId, context.activeCommunityId);
    if (!communityId) throw new Error("You don't manage a community yet.");

    const clash = await sql`
      SELECT id FROM public.dues_rates
      WHERE community_id = ${communityId}::uuid AND lower(name) = lower(${data.name})
        AND id IS DISTINCT FROM ${data.id ?? null}::uuid
      LIMIT 1
    `;
    if (clash[0]) throw new Error("A rate with that name already exists.");

    if (data.id) {
      await sql`
        UPDATE public.dues_rates
        SET name = ${data.name}, amount_ngn = ${data.amountNgn ?? null}, amount_usd = ${data.amountUsd ?? null}, updated_at = now()
        WHERE id = ${data.id}::uuid AND community_id = ${communityId}::uuid
      `;
    } else {
      await sql`
        INSERT INTO public.dues_rates (community_id, name, amount_ngn, amount_usd)
        VALUES (${communityId}::uuid, ${data.name}, ${data.amountNgn ?? null}, ${data.amountUsd ?? null})
      `;
    }
    return { ok: true };
  });

// Members on a deleted rate go back to the plan default (FK is ON DELETE SET NULL).
export const deleteDuesRate = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const communityId = await communityIdForAdmin(context.userId, context.activeCommunityId);
    if (!communityId) throw new Error("You don't manage a community yet.");
    await sql`DELETE FROM public.dues_rates WHERE id = ${data.id}::uuid AND community_id = ${communityId}::uuid`;
    return { ok: true };
  });
