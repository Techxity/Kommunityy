// Authorization helpers for payment/payout server functions.
// Login/identity comes from the Neon-backed session (see requireAuth in
// @/lib/auth/require-auth, which verifies the caller's session cookie and
// gives us a trusted userId). The actual permission check runs as a plain
// query against Neon — there is no database-level RLS doing this for us,
// so every server function that touches sensitive data must call one of
// these first.
import { sql } from "@/lib/db/client";

export async function assertCommunityAdmin(userId: string, communityId: string): Promise<void> {
  const rows = await sql`SELECT public.is_community_admin(${userId}::uuid, ${communityId}::uuid) AS ok`;
  if (rows[0]?.ok !== true) throw new Error("Not authorized for this community");
}

export async function assertSuperAdmin(userId: string): Promise<void> {
  const rows = await sql`SELECT public.is_super_admin(${userId}::uuid) AS ok`;
  if (rows[0]?.ok !== true) throw new Error("Super admin access required");
}
