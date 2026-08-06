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

// The community the logged-in admin actually belongs to (as opposed to
// getDefaultCommunity's single-tenant "first ever" guess) — used by the
// admin shell/dashboard for the community name and trial countdown.
export const getMyCommunity = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const rows = await sql`
      SELECT c.id, c.name, c.trial_ends_at
      FROM public.communities c
      JOIN public.user_roles ur ON ur.community_id = c.id
      WHERE ur.user_id = ${context.userId}::uuid
        AND ur.role = 'community_admin'
      ORDER BY c.created_at ASC
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) return null;

    const trialEndsAt = row.trial_ends_at as string | null;
    const trialDaysLeft = trialEndsAt
      ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
      : 0;

    return { id: row.id as string, name: row.name as string, trialDaysLeft };
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
