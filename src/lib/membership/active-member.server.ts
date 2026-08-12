// Resolves which membership a signed-in user is currently acting as. A single
// account can be an active member of several communities; this picks the one
// the session is pinned to (activeCommunityId, set on login or via the
// switcher), and falls back to their earliest membership when the session has
// no pin or the pinned community is no longer valid.
//
// Every member-facing query goes through this so switching communities changes
// what the member sees consistently, instead of an arbitrary `LIMIT 1`.
import { sql } from "@/lib/db/client";

export type ActiveMember = { memberId: string; communityId: string; email: string | null };

export async function resolveActiveMember(
  userId: string,
  activeCommunityId?: string | null,
): Promise<ActiveMember | null> {
  if (activeCommunityId) {
    const rows = await sql`
      SELECT id, community_id, email FROM public.members
      WHERE user_id = ${userId}::uuid AND community_id = ${activeCommunityId}::uuid AND status = 'active'
      LIMIT 1
    `;
    if (rows[0]) {
      return { memberId: rows[0].id as string, communityId: rows[0].community_id as string, email: (rows[0].email as string | null) ?? null };
    }
  }
  // Fallback: earliest active membership (stable ordering so the "default"
  // community doesn't jump around between requests).
  const rows = await sql`
    SELECT id, community_id, email FROM public.members
    WHERE user_id = ${userId}::uuid AND status = 'active'
    ORDER BY joined_at ASC NULLS LAST
    LIMIT 1
  `;
  return rows[0]
    ? { memberId: rows[0].id as string, communityId: rows[0].community_id as string, email: (rows[0].email as string | null) ?? null }
    : null;
}
