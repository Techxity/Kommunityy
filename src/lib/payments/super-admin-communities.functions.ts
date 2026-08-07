import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { sql } from "@/lib/db/client";
import { requireAuth } from "@/lib/auth/require-auth.server";
import { assertSuperAdmin } from "./authz";

function statusFor(trialEndsAt: string | null, tierName: string | null, suspended: boolean): "Active" | "Trial" | "Trial ended" | "Suspended" {
  if (suspended) return "Suspended";
  if (trialEndsAt && new Date(trialEndsAt).getTime() > Date.now()) return "Trial";
  if (tierName) return "Active";
  return "Trial ended";
}

// Every community on the platform — real data replacing the old
// prototype communities-store.ts, which never saw actual signups.
export const listCommunitiesForSuperAdmin = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.userId);

    const rows = await sql`
      SELECT
        c.id, c.name, c.type, c.created_at, c.trial_ends_at, c.suspended,
        t.name AS tier_name, t.monthly_price_ngn,
        owner.email AS owner_email, owner.name AS owner_name,
        COALESCE(mc.member_count, 0) AS member_count
      FROM public.communities c
      LEFT JOIN public.subscription_tiers t ON t.id = c.tier_id
      LEFT JOIN LATERAL (
        SELECT u.email, u.name
        FROM public.user_roles ur
        JOIN public.users u ON u.id = ur.user_id
        WHERE ur.community_id = c.id AND ur.role = 'community_admin'
        ORDER BY ur.created_at ASC
        LIMIT 1
      ) owner ON true
      LEFT JOIN LATERAL (
        SELECT count(*) AS member_count FROM public.members m WHERE m.community_id = c.id AND m.status = 'active'
      ) mc ON true
      ORDER BY c.created_at DESC
    `;

    return rows.map((r) => ({
      id: r.id as string,
      name: r.name as string,
      type: (r.type as string | null) ?? "—",
      ownerEmail: (r.owner_email as string | null) ?? "—",
      ownerName: (r.owner_name as string | null) ?? "—",
      plan: (r.tier_name as string | null) ?? "No plan",
      mrrNgn: r.monthly_price_ngn != null ? Number(r.monthly_price_ngn) : 0,
      members: Number(r.member_count),
      status: statusFor(r.trial_ends_at as string | null, r.tier_name as string | null, r.suspended as boolean),
      suspended: r.suspended as boolean,
      trialEndsAt: r.trial_ends_at ? new Date(r.trial_ends_at as string).toLocaleDateString() : null,
      joined: new Date(r.created_at as string).toLocaleDateString(),
    }));
  });

export const setCommunitySuspended = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid(), suspended: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    await sql`UPDATE public.communities SET suspended = ${data.suspended}, updated_at = now() WHERE id = ${data.id}::uuid`;
    return { ok: true };
  });
