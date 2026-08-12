import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { sql, withTransaction } from "@/lib/db/client";
import { hashPassword, verifyPassword, DUMMY_PASSWORD_HASH } from "./password";
import { createSession, revokeAllSessionsForUser, revokeSessionToken, setSessionActiveCommunity } from "./session.server";
import { resolveActiveMember } from "@/lib/membership/active-member.server";
import { setSessionCookie, clearSessionCookie, readSessionToken } from "./session-cookie.server";
import { assertNotRateLimited, recordAttempt, clientIp } from "./rate-limit.server";
import { getSessionUser, requireAuth } from "./require-auth.server";
import { uniqueCommunitySlug } from "@/lib/slug.server";
import { errorBoundary } from "@/lib/error-boundary.server";
import { AppError } from "@/lib/errors";
import { createAndSendReset, hashResetToken } from "./password-reset.server";

async function rolesFor(userId: string) {
  const rows = await sql`
    SELECT role, community_id FROM public.user_roles WHERE user_id = ${userId}::uuid
  `;
  const isSuperAdmin = rows.some((r) => r.role === "super_admin");
  const communityAdminOf = (rows.find((r) => r.role === "community_admin")?.community_id as string | undefined) ?? null;
  const memberOf = (rows.find((r) => r.role === "member")?.community_id as string | undefined) ?? null;
  return { isSuperAdmin, communityAdminOf, isMember: !!memberOf, memberOf };
}

// Creates a brand-new community together with its first (community_admin)
// user account, then logs them in.
//
// Plan handling: if `tierId` is omitted, the community defaults to the
// platform's configured free trial (platform_settings) — trial_tier_id's
// modules apply immediately, trial_ends_at counts down from trial_days.
// If `tierId` IS given, the community is created with NO tier and NO trial
// — the caller is expected to immediately kick off a Paystack checkout
// (startPlanCheckout) for that tier. The tier only actually gets applied
// once the paystack-webhook confirms payment, so an abandoned checkout
// never grants paid access for free.
export const signup = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z
      .object({
        communityName: z.string().min(2).max(120),
        communityType: z.string().max(60).optional(),
        name: z.string().min(1).max(120),
        email: z.string().email().max(200),
        password: z.string().min(8).max(200),
        tierId: z.string().uuid().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const ip = clientIp();
    await assertNotRateLimited(`signup:${ip}`, 10, 60 * 60 * 1000);
    await recordAttempt(`signup:${ip}`);

    const email = data.email.trim().toLowerCase();
    const existing = await sql`SELECT id FROM public.users WHERE email = ${email} LIMIT 1`;
    if (existing[0]) throw new Error("An account with that email already exists.");

    let tierId: string | null = null;
    let trialEndsAt: string | null = null;

    if (data.tierId) {
      const tiers = await sql`SELECT id, active FROM public.subscription_tiers WHERE id = ${data.tierId}::uuid`;
      if (!tiers[0]) throw new Error("Selected plan not found.");
      if (!tiers[0].active) throw new Error("Selected plan is no longer available.");
      // tierId stays null here on purpose — applied only after payment.
    } else {
      const settings = await sql`SELECT trial_enabled, trial_days, trial_tier_id FROM public.platform_settings WHERE id = true`;
      const trialEnabled = settings[0]?.trial_enabled !== false;
      if (!trialEnabled) throw new Error("Free trials aren't available right now — please select a plan.");
      const trialDays = Number(settings[0]?.trial_days ?? 14);
      tierId = (settings[0]?.trial_tier_id as string | null) ?? null;
      trialEndsAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toISOString();
    }

    const passwordHash = await hashPassword(data.password);
    const userId = crypto.randomUUID();
    const communityId = crypto.randomUUID();
    const slug = await uniqueCommunitySlug(data.communityName);

    try {
      await withTransaction((tx) => [
        tx`INSERT INTO public.users (id, email, password_hash, name) VALUES (${userId}::uuid, ${email}, ${passwordHash}, ${data.name})`,
        tx`INSERT INTO public.communities (id, name, slug, type, tier_id, trial_ends_at) VALUES (${communityId}::uuid, ${data.communityName}, ${slug}, ${data.communityType ?? null}, ${tierId}, ${trialEndsAt})`,
        tx`INSERT INTO public.user_roles (user_id, role, community_id) VALUES (${userId}::uuid, 'community_admin', ${communityId}::uuid)`,
      ]);
    } catch (e: any) {
      if (String(e?.message ?? "").toLowerCase().includes("unique")) {
        throw new Error("An account with that email already exists.");
      }
      throw new Error("Could not create your account — please try again.");
    }

    const token = await createSession(userId);
    setSessionCookie(token);
    return { ok: true, communityId, needsPayment: !!data.tierId };
  });

export const login = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z
      .object({
        email: z.string().email().max(200),
        password: z.string().min(1).max(200),
        // Set when signing in via a community's branded /l/<slug> link — pins
        // the member portal to that community.
        communitySlug: z.string().min(1).max(80).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const ip = clientIp();
    const email = data.email.trim().toLowerCase();
    await assertNotRateLimited(`login:ip:${ip}`, 20, 15 * 60 * 1000);
    await assertNotRateLimited(`login:email:${email}`, 8, 15 * 60 * 1000);

    const rows = await sql`SELECT id, password_hash FROM public.users WHERE email = ${email} LIMIT 1`;
    const user = rows[0];
    // Always run the hash compare, even when the user doesn't exist, so the
    // response time doesn't leak whether the email has an account.
    const hashToCheck = (user?.password_hash as string | undefined) ?? DUMMY_PASSWORD_HASH;
    const passwordMatches = await verifyPassword(data.password, hashToCheck);

    await recordAttempt(`login:ip:${ip}`);
    await recordAttempt(`login:email:${email}`);

    if (!user || !passwordMatches) {
      throw new Error("Invalid email or password.");
    }

    const roles = await rolesFor(user.id as string);

    // A super admin can suspend a community from the platform console —
    // that blocks its admin and members from signing in until re-enabled.
    if (!roles.isSuperAdmin && (roles.communityAdminOf || roles.memberOf)) {
      const communityId = roles.communityAdminOf ?? roles.memberOf;
      const rows = await sql`SELECT suspended FROM public.communities WHERE id = ${communityId}::uuid`;
      if (rows[0]?.suspended) {
        throw new Error("This community has been suspended. Contact support for help.");
      }
    }

    // Session rotation: kill any pre-existing sessions, issue a fresh one.
    await revokeAllSessionsForUser(user.id as string);
    const token = await createSession(user.id as string);
    setSessionCookie(token);

    // Pin the member portal's active community: the one whose login link they
    // used (if they're a member there), else their earliest membership. Purely
    // for members — admins-only accounts leave it null and use /admin.
    let pinId: string | null = null;
    if (data.communitySlug) {
      const crows = await sql`SELECT id FROM public.communities WHERE slug = ${data.communitySlug} LIMIT 1`;
      const cid = crows[0]?.id as string | undefined;
      if (cid) {
        const mrows = await sql`
          SELECT 1 FROM public.members
          WHERE user_id = ${user.id}::uuid AND community_id = ${cid}::uuid AND status = 'active' LIMIT 1
        `;
        if (mrows[0]) pinId = cid;
      }
    }
    if (!pinId) {
      const active = await resolveActiveMember(user.id as string, null);
      pinId = active?.communityId ?? null;
    }
    if (pinId) await setSessionActiveCommunity(token, pinId);

    return { ok: true, ...roles };
  });

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  const token = readSessionToken();
  if (token) await revokeSessionToken(token);
  clearSessionCookie();
  return { ok: true };
});

// Public: current session, or null. Used for route guards and shell UI —
// not a substitute for `requireAuth` on server functions that touch private
// data (see the note in the middleware guide about beforeLoad vs. the data
// boundary).
export const me = createServerFn({ method: "POST" }).handler(async () => {
  const session = await getSessionUser();
  if (!session) return null;
  const rows = await sql`
    SELECT id, email, name FROM public.users WHERE id = ${session.userId}::uuid LIMIT 1
  `;
  const user = rows[0];
  if (!user) return null;
  const roles = await rolesFor(session.userId);
  return { id: user.id as string, email: user.email as string, name: (user.name as string | null) ?? null, ...roles };
});

// ── Password reset (forgot password, not signed in) ──────────────────────

// Public: emails a reset link if an account exists for the address. Always
// returns the same {ok:true} whether or not the email matched — never reveals
// which addresses have accounts (enumeration defense) — and is rate-limited
// per IP so it can't be used to spam arbitrary inboxes.
export const requestPasswordReset = createServerFn({ method: "POST" })
  .middleware([errorBoundary])
  .inputValidator((i) => z.object({ email: z.string().email().max(200) }).parse(i))
  .handler(async ({ data }) => {
    const ip = clientIp();
    await assertNotRateLimited(`pwreset:ip:${ip}`, 10, 60 * 60 * 1000);
    await recordAttempt(`pwreset:ip:${ip}`);

    const email = data.email.trim().toLowerCase();
    const rows = await sql`SELECT id, email, name FROM public.users WHERE email = ${email} LIMIT 1`;
    const user = rows[0];
    if (user) {
      await createAndSendReset({
        id: user.id as string,
        email: user.email as string,
        name: (user.name as string | null) ?? null,
      });
    }
    return { ok: true };
  });

// Public: what the reset page shows before the user types — the email the
// token belongs to, or null if the link is invalid/expired/used.
export const getResetInfo = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ token: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const tokenHash = await hashResetToken(data.token);
    const rows = await sql`
      SELECT u.email
      FROM public.password_resets pr
      JOIN public.users u ON u.id = pr.user_id
      WHERE pr.token_hash = ${tokenHash} AND pr.expires_at > now() AND pr.used_at IS NULL
      LIMIT 1
    `;
    return rows[0] ? { email: rows[0].email as string } : null;
  });

// Public: sets a new password from a valid reset token, then signs the user
// in. The token is single-use, and every existing session is revoked first so
// a leaked/stolen session can't outlive a password reset.
export const resetPassword = createServerFn({ method: "POST" })
  .middleware([errorBoundary])
  .inputValidator((i) => z.object({ token: z.string().min(10), password: z.string().min(8).max(200) }).parse(i))
  .handler(async ({ data }) => {
    const tokenHash = await hashResetToken(data.token);
    const rows = await sql`
      SELECT id, user_id FROM public.password_resets
      WHERE token_hash = ${tokenHash} AND expires_at > now() AND used_at IS NULL
      LIMIT 1
    `;
    const reset = rows[0];
    if (!reset) throw new AppError("This reset link is invalid or has expired. Please request a new one.");

    const userId = reset.user_id as string;
    const passwordHash = await hashPassword(data.password);
    await withTransaction((tx) => [
      tx`UPDATE public.users SET password_hash = ${passwordHash}, updated_at = now() WHERE id = ${userId}::uuid`,
      tx`UPDATE public.password_resets SET used_at = now() WHERE id = ${reset.id}::uuid`,
    ]);

    // Log out everywhere, then start a fresh session for this device.
    await revokeAllSessionsForUser(userId);
    const token = await createSession(userId);
    setSessionCookie(token);

    const roles = await rolesFor(userId);
    return { ok: true, ...roles };
  });

// ── Change password (signed in) ──────────────────────────────────────────

// Requires the current password (so a hijacked, still-open session can't
// silently change it), then rotates every session and keeps this device
// signed in on a fresh one.
export const changePassword = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((i) =>
    z.object({ currentPassword: z.string().min(1).max(200), newPassword: z.string().min(8).max(200) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const rows = await sql`SELECT password_hash FROM public.users WHERE id = ${context.userId}::uuid LIMIT 1`;
    const user = rows[0];
    if (!user) throw new AppError("Account not found.");

    const ok = await verifyPassword(data.currentPassword, user.password_hash as string);
    if (!ok) throw new AppError("Your current password is incorrect.");
    if (data.newPassword === data.currentPassword) {
      throw new AppError("Your new password must be different from your current one.");
    }

    const passwordHash = await hashPassword(data.newPassword);
    await sql`UPDATE public.users SET password_hash = ${passwordHash}, updated_at = now() WHERE id = ${context.userId}::uuid`;

    await revokeAllSessionsForUser(context.userId);
    const token = await createSession(context.userId);
    setSessionCookie(token);
    return { ok: true };
  });
