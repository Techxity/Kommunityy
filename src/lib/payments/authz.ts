// Authorization helpers for payment/payout server functions.
// These run inside server function handlers using the caller's own
// (RLS-scoped) Supabase client, so a client cannot spoof its role.
import type { SupabaseClient } from "@supabase/supabase-js";

type Client = SupabaseClient<any, any, any>;

export async function assertCommunityAdmin(
  supabase: Client,
  userId: string,
  communityId: string,
): Promise<void> {
  const { data, error } = await supabase.rpc("is_community_admin", {
    _user_id: userId,
    _community_id: communityId,
  });
  if (error) throw new Error("Not authorized");
  if (data !== true) throw new Error("Not authorized for this community");
}

export async function assertSuperAdmin(supabase: Client, userId: string): Promise<void> {
  const { data, error } = await supabase.rpc("is_super_admin", { _user_id: userId });
  if (error) throw new Error("Not authorized");
  if (data !== true) throw new Error("Super admin access required");
}
