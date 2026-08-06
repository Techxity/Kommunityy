import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { sql } from "@/lib/db/client";
import { requireAuth } from "@/lib/auth/require-auth.server";
import { communityIdForAdmin } from "@/lib/payments/communities.functions";

// Public: chapter names/regions are shown on the public join page so an
// applicant can pick theirs — nothing sensitive here.
export const listChaptersForCommunity = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ communityId: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    return sql`
      SELECT id, name, region, coordinator
      FROM public.chapters
      WHERE community_id = ${data.communityId}::uuid
      ORDER BY name ASC
    `;
  });

// Admin: chapters for the logged-in admin's own community.
export const listMyChapters = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const communityId = await communityIdForAdmin(context.userId);
    if (!communityId) return [];
    const rows = await sql`
      SELECT c.id, c.name, c.region, c.coordinator,
        (SELECT count(*)::int FROM public.members m WHERE m.chapter_id = c.id) AS member_count
      FROM public.chapters c
      WHERE c.community_id = ${communityId}::uuid
      ORDER BY c.name ASC
    `;
    return rows.map((r) => ({
      id: r.id as string,
      name: r.name as string,
      region: (r.region as string | null) ?? "",
      coordinator: (r.coordinator as string | null) ?? "",
      memberCount: r.member_count as number,
    }));
  });

export const createChapter = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((i) =>
    z.object({ name: z.string().min(1).max(120), region: z.string().max(120).optional(), coordinator: z.string().max(120).optional() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const communityId = await communityIdForAdmin(context.userId);
    if (!communityId) throw new Error("You don't manage a community yet.");
    await sql`
      INSERT INTO public.chapters (community_id, name, region, coordinator)
      VALUES (${communityId}::uuid, ${data.name}, ${data.region ?? null}, ${data.coordinator ?? null})
    `;
    return { ok: true };
  });

export const updateChapter = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((i) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().min(1).max(120),
        region: z.string().max(120).optional(),
        coordinator: z.string().max(120).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const communityId = await communityIdForAdmin(context.userId);
    if (!communityId) throw new Error("You don't manage a community yet.");
    await sql`
      UPDATE public.chapters
      SET name = ${data.name}, region = ${data.region ?? null}, coordinator = ${data.coordinator ?? null}
      WHERE id = ${data.id}::uuid AND community_id = ${communityId}::uuid
    `;
    return { ok: true };
  });

export const deleteChapter = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const communityId = await communityIdForAdmin(context.userId);
    if (!communityId) throw new Error("You don't manage a community yet.");
    await sql`DELETE FROM public.chapters WHERE id = ${data.id}::uuid AND community_id = ${communityId}::uuid`;
    return { ok: true };
  });
