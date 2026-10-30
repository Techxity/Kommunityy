// Admin side of the phone-login "Set up account" flow. claimMemberAccount
// (auth.functions.ts) only files a request when a phone-only member asks for a
// login; nothing can sign in as that member until an admin of the community
// approves it here — ideally after confirming with the member directly, since
// name + phone alone are known to other members.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { sql, withTransaction } from "@/lib/db/client";
import { requireAuth } from "@/lib/auth/require-auth.server";
import { communityIdForAdmin } from "@/lib/payments/communities.functions";
import { AppError } from "@/lib/errors";

export const listAccountClaims = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const communityId = await communityIdForAdmin(context.userId, context.activeCommunityId);
    if (!communityId) return [];
    const rows = await sql`
      SELECT mac.id, mac.phone, mac.requested_at, m.id AS member_id, m.name, m.phone AS member_phone
      FROM public.member_account_claims mac
      JOIN public.members m ON m.id = mac.member_id
      WHERE mac.community_id = ${communityId}::uuid AND mac.status = 'pending'
      ORDER BY mac.requested_at ASC
    `;
    return rows.map((r) => ({
      id: r.id as string,
      memberId: r.member_id as string,
      name: r.name as string,
      phone: (r.member_phone as string | null) ?? (r.phone as string),
      requestedAt: new Date(r.requested_at as string).toISOString(),
    }));
  });

export const decideAccountClaim = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((i) => z.object({ claimId: z.string().uuid(), approve: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    const communityId = await communityIdForAdmin(context.userId, context.activeCommunityId);
    if (!communityId) throw new AppError("You don't manage a community yet.");

    if (!data.approve) {
      const rows = await sql`
        UPDATE public.member_account_claims
        SET status = 'rejected', password_hash = NULL, decided_at = now(), decided_by = ${context.userId}::uuid
        WHERE id = ${data.claimId}::uuid AND community_id = ${communityId}::uuid AND status = 'pending'
        RETURNING id
      `;
      if (!rows[0]) throw new AppError("This request has already been handled.");
      return { ok: true };
    }

    const claims = await sql`
      SELECT mac.member_id, mac.phone, m.name, m.status, m.user_id
      FROM public.member_account_claims mac
      JOIN public.members m ON m.id = mac.member_id
      WHERE mac.id = ${data.claimId}::uuid AND mac.community_id = ${communityId}::uuid AND mac.status = 'pending'
      LIMIT 1
    `;
    const claim = claims[0];
    if (!claim) throw new AppError("This request has already been handled.");
    if (claim.status !== "active")
      throw new AppError("This member isn't active any more — reject the request instead.");
    if (claim.user_id)
      throw new AppError("This member already has a login — reject the request instead.");
    const taken = await sql`SELECT 1 FROM public.users WHERE phone = ${claim.phone} LIMIT 1`;
    if (taken[0]) {
      throw new AppError(
        "That phone number already has an account. Reject this request and ask the member to sign in with their existing password.",
      );
    }

    // Each statement re-checks state, and the whole batch is atomic: if the
    // claim stopped being pending, no user row is inserted and the members
    // UPDATE then fails its foreign key, rolling everything back. A racing
    // second approval trips the unique phone index the same way.
    const userId = crypto.randomUUID();
    await withTransaction((tx) => [
      tx`INSERT INTO public.users (id, phone, password_hash, name)
         SELECT ${userId}::uuid, phone, password_hash, ${claim.name as string}
         FROM public.member_account_claims
         WHERE id = ${data.claimId}::uuid AND status = 'pending' AND password_hash IS NOT NULL`,
      tx`UPDATE public.members SET user_id = ${userId}::uuid, updated_at = now()
         WHERE id = ${claim.member_id as string}::uuid AND user_id IS NULL`,
      tx`UPDATE public.member_account_claims
         SET status = 'approved', password_hash = NULL, decided_at = now(), decided_by = ${context.userId}::uuid
         WHERE id = ${data.claimId}::uuid AND status = 'pending'`,
    ]);
    return { ok: true };
  });
