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
      SELECT m.*, c.name AS chapter_name
      FROM public.members m
      LEFT JOIN public.chapters c ON c.id = m.chapter_id
      WHERE m.id = ${active.memberId}::uuid
      LIMIT 1
    `;
    const row = rows[0];
    return row ? mapRow(row) : null;
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
          SELECT m.*, c.name AS chapter_name
          FROM public.members m
          LEFT JOIN public.chapters c ON c.id = m.chapter_id
          WHERE m.community_id = ${communityId}::uuid AND m.status = ${data.status}
          ORDER BY m.applied_at DESC
        `
      : await sql`
          SELECT m.*, c.name AS chapter_name
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
              email: z.string().email().max(200),
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

    // De-dupe the incoming batch itself (e.g. the same person listed twice
    // in the sheet) before touching the database.
    const seen = new Set<string>();
    const rows = data.rows.filter((r) => {
      const key = r.email.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    await assertMemberCapacity(communityId, rows.length);

    const emails = rows.map((r) => r.email.toLowerCase());
    const existingRows = await sql`
      SELECT lower(email) AS email FROM public.members
      WHERE community_id = ${communityId}::uuid AND lower(email) = ANY(${emails}::text[])
    `;
    const existingSet = new Set(existingRows.map((r) => r.email as string));

    const chapterRows = await sql`SELECT id, name FROM public.chapters WHERE community_id = ${communityId}::uuid`;
    const chapterByName = new Map(chapterRows.map((c) => [String(c.name).toLowerCase(), c.id as string]));

    // Bare "YYYY-MM-DD" only — anything else from a messy spreadsheet cell is
    // dropped rather than guessed at (ambiguous MM/DD vs DD/MM date formats
    // have burned this app before; better to leave it blank and let the admin
    // fix it via Edit member than silently store the wrong day).
    const cleanDob = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

    // Everything that isn't already a member — inserted in ONE multi-row
    // statement via unnest, instead of an INSERT per row.
    const toInsert = rows.filter((r) => !existingSet.has(r.email.toLowerCase()));

    // Maps a newly-inserted member's (lowercased) email to whether their
    // account-setup invite email went out, so results below stay in the
    // original upload order.
    const emailSentByEmail = new Map<string, boolean>();
    if (toInsert.length > 0) {
      // One jsonb array → one INSERT ... SELECT. jsonb_to_recordset maps
      // absent/null JSON keys straight to SQL NULL, so nullable columns
      // (phone, dob, chapter_id, …) need no special handling — cleaner and
      // safer than parallel typed arrays for a row shape this wide.
      const payload = toInsert.map((r) => ({
        name: r.name,
        email: r.email,
        phone: r.phone ?? null,
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
      // Invites still go one email per member (that's inherent), but the DB
      // work above is now a single round trip.
      for (const row of inserted) {
        const invite = await ensureMemberInvite(row.id as string).catch(() => ({ created: false, emailSent: false }));
        emailSentByEmail.set((row.email as string).toLowerCase(), !!invite.emailSent);
      }
    }

    const results = rows.map((r) => {
      const key = r.email.toLowerCase();
      if (existingSet.has(key)) {
        return { email: r.email, name: r.name, status: "skipped_duplicate" as const };
      }
      return { email: r.email, name: r.name, status: "created" as const, emailSent: emailSentByEmail.get(key) ?? false };
    });

    return {
      created: results.filter((r) => r.status === "created").length,
      skipped: results.filter((r) => r.status === "skipped_duplicate").length,
      emailsSent: results.filter((r) => r.emailSent).length,
      results,
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
