import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { sql } from "@/lib/db/client";
import { requireAuth } from "@/lib/auth/require-auth.server";
import { communityIdForAdmin } from "@/lib/payments/communities.functions";
import { ensureMemberInvite } from "./member-invite.server";

// Enforces the community's plan member cap (subscription_tiers.max_members)
// when activating members — otherwise "member limit" would just be a
// cosmetic number on the plan that nothing ever checks.
async function assertMemberCapacity(communityId: string, incoming: number): Promise<void> {
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

// Deliberately string-only — no `new Date(...)` round trip. A bare "date"
// column (dob) with no time component parses as UTC per spec, but if the
// driver ever hands back something not in that exact bare-date shape, the
// JS engine falls back to local-time parsing instead, which silently shifts
// the calendar day by the local timezone offset (e.g. a member born on the
// 7th shows as the 6th for anyone west of UTC). Postgres always puts
// YYYY-MM-DD first in its text output for both `date` and `timestamp(tz)`
// columns, so slicing the string directly sidesteps that whole class of bug.
function toDateString(v: unknown): string {
  if (!v) return "";
  const s = String(v);
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : "";
}

function mapRow(r: Record<string, unknown>) {
  return {
    id: r.id as string,
    name: r.name as string,
    email: (r.email as string | null) ?? "",
    phone: (r.phone as string | null) ?? "",
    whatsapp: (r.whatsapp as string | null) ?? "",
    dob: toDateString(r.dob),
    status: r.status as string,
    joined: toDateString(r.joined_at ?? r.applied_at),
    role: (r.role as string | null) ?? "",
    chapter: (r.chapter_name as string | null) ?? "",
    chapterId: (r.chapter_id as string | null) ?? "",
    country: (r.country as string | null) ?? "",
    address: (r.address as string | null) ?? "",
    extra: (r.extra as Record<string, string> | null) ?? {},
    hasAccount: !!r.user_id,
  };
}

// Admin: members (any status) for the logged-in admin's own community.
export const listMembers = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((i: unknown) => z.object({ status: z.enum(["pending", "active", "inactive", "rejected"]).optional() }).optional().parse(i) ?? {})
  .handler(async ({ data, context }) => {
    const communityId = await communityIdForAdmin(context.userId);
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
    const communityId = await communityIdForAdmin(context.userId);
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

// Bulk status change — covers approve/reject on the pending queue and
// enable/disable on the main members table.
export const setMembersStatus = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((i) =>
    z.object({ ids: z.array(z.string().uuid()).min(1), status: z.enum(["pending", "active", "inactive", "rejected"]) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const communityId = await communityIdForAdmin(context.userId);
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
