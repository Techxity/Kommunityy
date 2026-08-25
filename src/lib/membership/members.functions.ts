import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { sql } from "@/lib/db/client";
import { requireAuth } from "@/lib/auth/require-auth.server";
import { communityIdForAdmin } from "@/lib/payments/communities.functions";
import { ensureMemberInvite } from "./member-invite.server";
import { resolveActiveMember } from "./active-member.server";
import { readSessionToken } from "@/lib/auth/session-cookie.server";
import { setSessionActiveCommunity } from "@/lib/auth/session.server";
import { AppError } from "@/lib/errors";
import { toDateOnlyString, toTimestampIso } from "@/lib/date-only";
import { normalizeNgPhone } from "@/lib/sms/phone";

// Enforces the community's plan member cap (subscription_tiers.max_members)
// when activating members — otherwise "member limit" would just be a
// cosmetic number on the plan that nothing ever checks.
export async function assertMemberCapacity(communityId: string, incoming: number): Promise<void> {
  if (incoming <= 0) return;
  const rows = await sql`
    SELECT t.max_members
    FROM public.communities c
    LEFT JOIN public.subscription_tiers t ON t.id = c.tier_id
    WHERE c.id = ${communityId}::uuid
  `;
  const maxMembers = rows[0]?.max_members as number | null | undefined;
  if (maxMembers == null) return;
  const countRows = await sql`SELECT count(*) AS n FROM public.members WHERE community_id = ${communityId}::uuid AND status = 'active'`;
  const current = Number(countRows[0]?.n ?? 0);
  if (current + incoming > Number(maxMembers)) {
    throw new Error(`This would exceed your plan's member limit (${maxMembers} active members). Upgrade your plan or free up a slot first.`);
  }
}

function mapRow(r: Record<string, unknown>) {
  return {
    id: r.id as string,
    name: r.name as string,
    email: (r.email as string | null) ?? "",
    phone: (r.phone as string | null) ?? "",
    whatsapp: (r.whatsapp as string | null) ?? "",
    dob: toDateOnlyString(r.dob),
    status: r.status as string,
    joined: toDateOnlyString(r.joined_at ?? r.applied_at),
    // Full-precision timestamp for relative-time display ("20h ago") — the
    // bare `joined` field above is date-only and would make every
    // just-submitted application look like it happened at midnight UTC,
    // which is why "less than a minute ago" was rendering as "20h ago".
    appliedAt: toTimestampIso(r.applied_at),
    role: (r.role as string | null) ?? "",
    chapter: (r.chapter_name as string | null) ?? "",
    chapterId: (r.chapter_id as string | null) ?? "",
    country: (r.country as string | null) ?? "",
    address: (r.address as string | null) ?? "",
    extra: (r.extra as Record<string, string> | null) ?? {},
    hasAccount: !!r.user_id,
    communityName: (r.community_name as string | null) ?? "",
    smsOptOut: !!r.sms_opt_out,
    isAdmin: !!r.is_admin,
  };
}

// Member: the logged-in member's own profile, read via their linked
// members.user_id row rather than an admin-scoped community lookup.
export const getMyProfile = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    // Scope to the community the member is currently viewing, not an arbitrary
    // membership (a person can be a member of several communities).
    const active = await resolveActiveMember(context.userId, context.activeCommunityId);
    if (!active) return null;
    const rows = await sql`
      SELECT m.*, c.name AS chapter_name, comm.name AS community_name
      FROM public.members m
      LEFT JOIN public.chapters c ON c.id = m.chapter_id
      LEFT JOIN public.communities comm ON comm.id = m.community_id
      WHERE m.id = ${active.memberId}::uuid
      LIMIT 1
    `;
    const row = rows[0];
    return row ? mapRow(row) : null;
  });

// Member: edit their own profile. Deliberately cannot change their email —
// that's their login identity (and the invite/reset flows key off it), so it
// stays admin-managed. Scoped to the member's currently-active community.
export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((i) =>
    z
      .object({
        name: z.string().min(1).max(120),
        phone: z.string().max(60).optional(),
        whatsapp: z.string().max(60).optional(),
        dob: z.string().max(20).optional(),
        country: z.string().max(80).optional(),
        address: z.string().max(200).optional(),
        smsOptOut: z.boolean().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const active = await resolveActiveMember(context.userId, context.activeCommunityId);
    if (!active) throw new AppError("You don't have an active membership to update.");
    await sql`
      UPDATE public.members
      SET name = ${data.name},
          phone = ${data.phone ?? null},
          whatsapp = ${data.whatsapp ?? null},
          dob = ${data.dob ? data.dob : null}::date,
          country = ${data.country ?? null},
          address = ${data.address ?? null},
          sms_opt_out = ${data.smsOptOut ?? false},
          updated_at = now()
      WHERE id = ${active.memberId}::uuid
    `;
    return { ok: true };
  });

// Every "workspace" the signed-in account can act in: each community they
// administer (role: admin), each community they're an active member of (role:
// member), and the platform console if they're a super admin. Powers the
// unified workspace switcher shown in every shell. `active` marks the one the
// session is currently pinned to.
export type Workspace = {
  communityId: string | null;
  name: string;
  role: "admin" | "member" | "super";
  active: boolean;
};

export const listMyWorkspaces = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }): Promise<Workspace[]> => {
    const roleRows = await sql`SELECT role FROM public.user_roles WHERE user_id = ${context.userId}::uuid`;
    const isSuperAdmin = roleRows.some((r) => r.role === "super_admin");

    const adminRows = await sql`
      SELECT c.id, c.name
      FROM public.user_roles ur
      JOIN public.communities c ON c.id = ur.community_id
      WHERE ur.user_id = ${context.userId}::uuid AND ur.role = 'community_admin'
    `;
    const memberRows = await sql`
      SELECT c.id, c.name
      FROM public.members m
      JOIN public.communities c ON c.id = m.community_id
      WHERE m.user_id = ${context.userId}::uuid AND m.status = 'active'
    `;

    const workspaces: Workspace[] = [];
    for (const r of adminRows) {
      workspaces.push({ communityId: r.id as string, name: r.name as string, role: "admin", active: r.id === context.activeCommunityId });
    }
    for (const r of memberRows) {
      workspaces.push({ communityId: r.id as string, name: r.name as string, role: "member", active: r.id === context.activeCommunityId });
    }
    if (isSuperAdmin) {
      workspaces.push({ communityId: null, name: "Platform admin", role: "super", active: false });
    }
    // Alphabetical, with the platform console pinned to the bottom.
    workspaces.sort((a, b) =>
      a.role === "super" ? 1 : b.role === "super" ? -1 : a.name.localeCompare(b.name),
    );
    return workspaces;
  });

// Switch the active workspace: pins the chosen community onto this session so
// both admin resolution (communityIdForAdmin) and member resolution
// (resolveActiveMember) point at it. Validated: the caller must actually
// administer or be an active member of that community.
export const setActiveWorkspace = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((i) => z.object({ communityId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const admin = await sql`
      SELECT 1 FROM public.user_roles
      WHERE user_id = ${context.userId}::uuid AND community_id = ${data.communityId}::uuid AND role = 'community_admin'
      LIMIT 1
    `;
    let ok = !!admin[0];
    if (!ok) {
      const member = await sql`
        SELECT 1 FROM public.members
        WHERE user_id = ${context.userId}::uuid AND community_id = ${data.communityId}::uuid AND status = 'active'
        LIMIT 1
      `;
      ok = !!member[0];
    }
    if (!ok) throw new AppError("You don't have access to that community.");
    const token = readSessionToken();
    if (token) await setSessionActiveCommunity(token, data.communityId);
    return { ok: true };
  });

// Member: fellow active members who hold a named role (executive/officer
// positions) in the logged-in member's own community — powers the "Current
// executive members" widget on the member dashboard. Deliberately narrow:
// only name/role/email/phone, no dob/address/whatsapp, since this is
// visible to any regular member, not just admins.
export const listMyExecutives = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const active = await resolveActiveMember(context.userId, context.activeCommunityId);
    if (!active) return [];
    const rows = await sql`
      SELECT m2.id, m2.name, m2.role, m2.email, m2.phone
      FROM public.members m2
      WHERE m2.community_id = ${active.communityId}::uuid
        AND m2.status = 'active' AND m2.role IS NOT NULL AND m2.role <> ''
      ORDER BY m2.role ASC, m2.name ASC
      LIMIT 12
    `;
    return rows.map((r) => ({
      id: r.id as string,
      name: r.name as string,
      role: r.role as string,
      email: (r.email as string | null) ?? "",
      phone: (r.phone as string | null) ?? "",
    }));
  });

// Admin: members (any status) for the logged-in admin's own community.
export const listMembers = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((i: unknown) => z.object({ status: z.enum(["pending", "active", "inactive", "rejected"]).optional() }).optional().parse(i) ?? {})
  .handler(async ({ data, context }) => {
    const communityId = await communityIdForAdmin(context.userId, context.activeCommunityId);
    if (!communityId) return [];

    const rows = data?.status
      ? await sql`
          SELECT m.*, c.name AS chapter_name,
            EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = m.user_id AND ur.community_id = m.community_id AND ur.role = 'community_admin') AS is_admin
          FROM public.members m
          LEFT JOIN public.chapters c ON c.id = m.chapter_id
          WHERE m.community_id = ${communityId}::uuid AND m.status = ${data.status}
          ORDER BY m.applied_at DESC
        `
      : await sql`
          SELECT m.*, c.name AS chapter_name,
            EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = m.user_id AND ur.community_id = m.community_id AND ur.role = 'community_admin') AS is_admin
          FROM public.members m
          LEFT JOIN public.chapters c ON c.id = m.chapter_id
          WHERE m.community_id = ${communityId}::uuid
          ORDER BY m.applied_at DESC
        `;
    return rows.map(mapRow);
  });

export const updateMember = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((i) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().min(1).max(120),
        email: z.string().max(200).optional(),
        phone: z.string().max(60).optional(),
        whatsapp: z.string().max(60).optional(),
        dob: z.string().max(20).optional(),
        role: z.string().max(60).optional(),
        country: z.string().max(80).optional(),
        chapterId: z.string().uuid().optional().nullable(),
        status: z.enum(["pending", "active", "inactive", "rejected"]),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const communityId = await communityIdForAdmin(context.userId, context.activeCommunityId);
    if (!communityId) throw new Error("You don't manage a community yet.");

    if (data.status === "active") {
      const prevRows = await sql`SELECT status FROM public.members WHERE id = ${data.id}::uuid AND community_id = ${communityId}::uuid`;
      if (prevRows[0]?.status !== "active") await assertMemberCapacity(communityId, 1);
    }

    await sql`
      UPDATE public.members
      SET
        name = ${data.name},
        email = ${data.email ?? null},
        phone = ${data.phone ?? null},
        whatsapp = ${data.whatsapp ?? null},
        dob = ${data.dob ? data.dob : null}::date,
        role = ${data.role ?? null},
        country = ${data.country ?? null},
        chapter_id = ${data.chapterId ?? null},
        status = ${data.status},
        joined_at = CASE WHEN ${data.status} = 'active' AND joined_at IS NULL THEN now() ELSE joined_at END,
        updated_at = now()
      WHERE id = ${data.id}::uuid AND community_id = ${communityId}::uuid
    `;
    // Best-effort: if this activates a member who doesn't have a login yet,
    // send them an account-setup invite. Never let an email hiccup block
    // the save itself.
    if (data.status === "active") {
      await ensureMemberInvite(data.id).catch(() => {});
    }
    return { ok: true };
  });

// Admin-driven bulk import: unlike sendInvites (which emails a link to the
// public join form and leaves them in "pending" until approved), this
// creates fully-formed member records as 'active' immediately and sends
// each one the same account-setup email a normally-approved member gets
// (ensureMemberInvite — a secure one-time link, never a shared/default
// password). Meant for admins who already have a member roster in a
// spreadsheet and don't want everyone re-entering their own details through
// the join form.
export const bulkCreateMembers = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((i) =>
    z
      .object({
        rows: z
          .array(
            z.object({
              name: z.string().min(1).max(120),
              email: z.string().max(200).optional(),
              phone: z.string().max(60).optional(),
              whatsapp: z.string().max(60).optional(),
              dob: z.string().max(20).optional(),
              role: z.string().max(60).optional(),
              chapter: z.string().max(120).optional(),
            }),
          )
          .min(1)
          .max(500),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const communityId = await communityIdForAdmin(context.userId, context.activeCommunityId);
    if (!communityId) throw new Error("You don't manage a community yet.");

    // Normalize each row's identities (email or phone). A member needs at least
    // one; rows with neither are dropped (the uploader already filters these).
    type Norm = {
      name: string; email: string | null; phone: string | null; phoneNorm: string | null;
      whatsapp?: string; dob?: string; role?: string; chapter?: string;
    };
    const norm: Norm[] = [];
    for (const r of data.rows) {
      const email = (r.email ?? "").trim().toLowerCase() || null;
      const phone = (r.phone ?? "").trim() || null;
      const phoneNorm = phone ? normalizeNgPhone(phone) : null;
      if (!email && !phoneNorm) continue;
      norm.push({ name: r.name, email, phone, phoneNorm, whatsapp: r.whatsapp, dob: r.dob, role: r.role, chapter: r.chapter });
    }
    if (norm.length === 0) throw new Error("No valid rows — each member needs a name and an email or a phone number.");

    // De-dupe the incoming batch by email or normalized phone.
    const seen = new Set<string>();
    const rows = norm.filter((r) => {
      const key = r.email ?? r.phoneNorm!;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    await assertMemberCapacity(communityId, rows.length);

    // Existing members in this community, to skip anyone already there (by
    // email OR phone).
    const existing = await sql`
      SELECT lower(email) AS email, phone FROM public.members WHERE community_id = ${communityId}::uuid
    `;
    const existEmail = new Set<string>();
    const existPhone = new Set<string>();
    for (const e of existing) {
      if (e.email) existEmail.add(e.email as string);
      const pn = e.phone ? normalizeNgPhone(e.phone as string) : null;
      if (pn) existPhone.add(pn);
    }
    const isDupe = (r: Norm) => !!((r.email && existEmail.has(r.email)) || (r.phoneNorm && existPhone.has(r.phoneNorm)));

    const chapterRows = await sql`SELECT id, name FROM public.chapters WHERE community_id = ${communityId}::uuid`;
    const chapterByName = new Map(chapterRows.map((c) => [String(c.name).toLowerCase(), c.id as string]));

    // Bare "YYYY-MM-DD" only — anything else from a messy spreadsheet cell is
    // dropped rather than guessed at (ambiguous MM/DD vs DD/MM date formats
    // have burned this app before; better to leave it blank).
    const cleanDob = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

    const toInsert = rows.filter((r) => !isDupe(r));
    let emailsSent = 0;
    if (toInsert.length > 0) {
      const payload = toInsert.map((r) => ({
        name: r.name,
        email: r.email,
        phone: r.phone,
        whatsapp: r.whatsapp ?? null,
        dob: cleanDob(r.dob),
        role: r.role ?? null,
        chapter_id: r.chapter ? (chapterByName.get(r.chapter.toLowerCase()) ?? null) : null,
      }));
      const inserted = await sql`
        INSERT INTO public.members (community_id, name, email, phone, whatsapp, dob, role, chapter_id, status, joined_at)
        SELECT ${communityId}::uuid, x.name, x.email, x.phone, x.whatsapp, x.dob::date, x.role, x.chapter_id::uuid, 'active', now()
        FROM jsonb_to_recordset(${JSON.stringify(payload)}::jsonb)
          AS x(name text, email text, phone text, whatsapp text, dob text, role text, chapter_id text)
        RETURNING id, email
      `;
      // Only members with an email get a setup-invite email; phone-only members
      // set up their login from the community login page's "Set up account" tab.
      for (const row of inserted) {
        if (!row.email) continue;
        const invite = await ensureMemberInvite(row.id as string).catch(() => ({ created: false, emailSent: false }));
        if (invite.emailSent) emailsSent++;
      }
    }

    return {
      created: toInsert.length,
      skipped: rows.length - toInsert.length,
      emailsSent,
    };
  });

// Bulk status change — covers approve/reject on the pending queue and
// enable/disable on the main members table.
export const setMembersStatus = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((i) =>
    z.object({ ids: z.array(z.string().uuid()).min(1), status: z.enum(["pending", "active", "inactive", "rejected"]) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const communityId = await communityIdForAdmin(context.userId, context.activeCommunityId);
    if (!communityId) throw new Error("You don't manage a community yet.");

    if (data.status === "active") {
      const notYetActive = await sql`
        SELECT count(*) AS n FROM public.members
        WHERE community_id = ${communityId}::uuid AND id = ANY(${data.ids}::uuid[]) AND status <> 'active'
      `;
      await assertMemberCapacity(communityId, Number(notYetActive[0]?.n ?? 0));
    }

    await sql`
      UPDATE public.members
      SET
        status = ${data.status},
        joined_at = CASE WHEN ${data.status} = 'active' AND joined_at IS NULL THEN now() ELSE joined_at END,
        updated_at = now()
      WHERE community_id = ${communityId}::uuid AND id = ANY(${data.ids}::uuid[])
    `;
    if (data.status === "active") {
      await Promise.all(data.ids.map((id) => ensureMemberInvite(id).catch(() => {})));
    }
    return { ok: true };
  });

// Admin: reset a phone-only member's login so they can set a fresh password.
// Since phone-first accounts have no email (so can't use "Forgot password"),
// this deletes the member's phone-first user account — members.user_id is
// ON DELETE SET NULL (unlinks the membership) and sessions cascade — after
// which the member re-registers with a new password from the community login
// page's "Set up account" tab. Deliberately refuses to touch an account that
// has an email (they can self-reset), or one shared across communities / used
// as an admin login (deleting it would break their other access).
export const resetMemberLogin = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((i) => z.object({ memberId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const communityId = await communityIdForAdmin(context.userId, context.activeCommunityId);
    if (!communityId) throw new AppError("You don't manage a community yet.");

    const rows = await sql`
      SELECT user_id FROM public.members WHERE id = ${data.memberId}::uuid AND community_id = ${communityId}::uuid LIMIT 1
    `;
    const member = rows[0];
    if (!member) throw new AppError("Member not found.");
    const userId = member.user_id as string | null;
    if (!userId) throw new AppError("This member hasn't set up a login yet — there's nothing to reset.");

    const users = await sql`SELECT email FROM public.users WHERE id = ${userId}::uuid LIMIT 1`;
    if (users[0]?.email) {
      throw new AppError("This member signs in with an email — they can reset their own password using the 'Forgot password' link. No admin reset needed.");
    }

    const otherMemberships = await sql`SELECT 1 FROM public.members WHERE user_id = ${userId}::uuid AND id <> ${data.memberId}::uuid LIMIT 1`;
    const roles = await sql`SELECT 1 FROM public.user_roles WHERE user_id = ${userId}::uuid LIMIT 1`;
    if (otherMemberships[0] || roles[0]) {
      throw new AppError("This login is used across more than one community (or is an admin login), so it can't be reset here. Ask the member to sign in with their existing password, or contact support.");
    }

    await sql`DELETE FROM public.users WHERE id = ${userId}::uuid`;
    return { ok: true };
  });

// ── Roles: make a member an admin, or remove admin ──────────────────────

// Grants the member's user account the community_admin role for this community.
// They keep their membership (dual role) and can switch to the admin console
// via the workspace switcher. Requires the member to have a login account.
export const promoteMemberToAdmin = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((i) => z.object({ memberId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const communityId = await communityIdForAdmin(context.userId, context.activeCommunityId);
    if (!communityId) throw new AppError("You don't manage a community yet.");
    const rows = await sql`
      SELECT user_id, status FROM public.members WHERE id = ${data.memberId}::uuid AND community_id = ${communityId}::uuid LIMIT 1
    `;
    const member = rows[0];
    if (!member) throw new AppError("Member not found.");
    const userId = member.user_id as string | null;
    if (!userId) throw new AppError("This member needs to set up their login account before they can be made an admin.");
    if (member.status !== "active") throw new AppError("Only active members can be made admins.");
    await sql`
      INSERT INTO public.user_roles (user_id, role, community_id)
      VALUES (${userId}::uuid, 'community_admin', ${communityId}::uuid)
      ON CONFLICT DO NOTHING
    `;
    return { ok: true };
  });

// Removes the community_admin role from a member (they stay a member). Guards
// against removing the last admin of the community.
export const demoteMemberAdmin = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((i) => z.object({ memberId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const communityId = await communityIdForAdmin(context.userId, context.activeCommunityId);
    if (!communityId) throw new AppError("You don't manage a community yet.");
    const rows = await sql`
      SELECT user_id FROM public.members WHERE id = ${data.memberId}::uuid AND community_id = ${communityId}::uuid LIMIT 1
    `;
    const userId = rows[0]?.user_id as string | null | undefined;
    if (!userId) throw new AppError("This member isn't an admin.");
    const admins = await sql`
      SELECT COUNT(*)::int AS n FROM public.user_roles WHERE community_id = ${communityId}::uuid AND role = 'community_admin'
    `;
    if (Number(admins[0]?.n ?? 0) <= 1) {
      throw new AppError("You can't remove the community's only admin. Make someone else an admin first.");
    }
    await sql`
      DELETE FROM public.user_roles WHERE user_id = ${userId}::uuid AND community_id = ${communityId}::uuid AND role = 'community_admin'
    `;
    return { ok: true };
  });

// ── Admin as a dues-paying member ───────────────────────────────────────

// Is the signed-in admin also an active member of their current community?
export const getMyMembershipHere = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const communityId = await communityIdForAdmin(context.userId, context.activeCommunityId);
    if (!communityId) return { hasCommunity: false, isMember: false };
    const rows = await sql`
      SELECT 1 FROM public.members WHERE community_id = ${communityId}::uuid AND user_id = ${context.userId}::uuid AND status = 'active' LIMIT 1
    `;
    return { hasCommunity: true, isMember: !!rows[0] };
  });

// Adds the signed-in admin as a member of their own community (so they can pay
// dues from the app). Links an existing unclaimed member row with their email
// if one exists; otherwise creates a fresh active member. Idempotent.
export const joinMyCommunityAsMember = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const communityId = await communityIdForAdmin(context.userId, context.activeCommunityId);
    if (!communityId) throw new AppError("You don't manage a community yet.");

    const already = await sql`SELECT id FROM public.members WHERE community_id = ${communityId}::uuid AND user_id = ${context.userId}::uuid LIMIT 1`;
    if (already[0]) {
      await sql`INSERT INTO public.user_roles (user_id, role, community_id) VALUES (${context.userId}::uuid, 'member', ${communityId}::uuid) ON CONFLICT DO NOTHING`;
      return { ok: true };
    }

    const users = await sql`SELECT name, email, phone FROM public.users WHERE id = ${context.userId}::uuid LIMIT 1`;
    const u = users[0];
    if (!u) throw new AppError("Account not found.");
    const name = (u.name as string | null) ?? "Admin";
    const email = (u.email as string | null) ?? null;
    const phone = (u.phone as string | null) ?? null;

    // Link an existing member row with this admin's email if one is unclaimed.
    if (email) {
      const byEmail = await sql`
        SELECT id, user_id FROM public.members WHERE community_id = ${communityId}::uuid AND lower(email) = lower(${email}) LIMIT 1
      `;
      if (byEmail[0]) {
        if (!byEmail[0].user_id) {
          await sql`UPDATE public.members SET user_id = ${context.userId}::uuid, status = 'active', joined_at = COALESCE(joined_at, now()), updated_at = now() WHERE id = ${byEmail[0].id}::uuid`;
        }
        await sql`INSERT INTO public.user_roles (user_id, role, community_id) VALUES (${context.userId}::uuid, 'member', ${communityId}::uuid) ON CONFLICT DO NOTHING`;
        return { ok: true };
      }
    }

    await assertMemberCapacity(communityId, 1);
    await sql`
      INSERT INTO public.members (community_id, name, email, phone, user_id, status, joined_at)
      VALUES (${communityId}::uuid, ${name}, ${email}, ${phone}, ${context.userId}::uuid, 'active', now())
    `;
    await sql`INSERT INTO public.user_roles (user_id, role, community_id) VALUES (${context.userId}::uuid, 'member', ${communityId}::uuid) ON CONFLICT DO NOTHING`;
    return { ok: true };
  });
