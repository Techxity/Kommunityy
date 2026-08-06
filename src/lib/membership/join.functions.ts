import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { sql } from "@/lib/db/client";
import { assertNotRateLimited, recordAttempt, clientIp } from "@/lib/auth/rate-limit.server";
import { FIELD_LIBRARY } from "@/lib/onboarding-fields";

// Fields that map straight onto a members column. Everything else in
// FIELD_LIBRARY (Year of Graduation, Matriculation number, etc.) gets
// stashed in members.extra instead.
const COLUMN_FOR_FIELD: Record<string, string> = {
  Name: "name",
  Email: "email",
  "Phone number": "phone",
  "WhatsApp Number": "whatsapp",
  "Date of Birth": "dob",
  Address: "address",
};

// Public: everything the /join/$communityId page needs in one round trip —
// the community's public info, its active onboarding fields, and its
// chapter list (for the Chapter dropdown).
export const getPublicJoinForm = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ communityId: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const communities = await sql`
      SELECT id, name, type, onboarding_fields
      FROM public.communities
      WHERE id = ${data.communityId}::uuid
      LIMIT 1
    `;
    const community = communities[0];
    if (!community) return null;

    const chapters = await sql`
      SELECT id, name, region FROM public.chapters
      WHERE community_id = ${data.communityId}::uuid
      ORDER BY name ASC
    `;

    return {
      community: { id: community.id as string, name: community.name as string, type: (community.type as string | null) ?? "" },
      fields: (community.onboarding_fields as string[] | null) ?? [],
      chapters: chapters.map((c) => ({ id: c.id as string, name: c.name as string, region: (c.region as string | null) ?? "" })),
    };
  });

// Public: a membership application submitted from the join page. Lands as
// a 'pending' member row for the community's admin to review.
export const submitApplication = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z
      .object({
        communityId: z.string().uuid(),
        values: z.record(z.string(), z.string()),
        chapterId: z.string().uuid().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const ip = clientIp();
    await assertNotRateLimited(`join:${ip}`, 10, 60 * 60 * 1000);
    await recordAttempt(`join:${ip}`);

    const communities = await sql`SELECT id FROM public.communities WHERE id = ${data.communityId}::uuid LIMIT 1`;
    if (!communities[0]) throw new Error("This community doesn't exist or is no longer accepting applications.");

    if (data.chapterId) {
      const chapters = await sql`
        SELECT id FROM public.chapters WHERE id = ${data.chapterId}::uuid AND community_id = ${data.communityId}::uuid
      `;
      if (!chapters[0]) throw new Error("Invalid chapter selection.");
    }

    const columns: Record<string, string | null> = { name: null, email: null, phone: null, whatsapp: null, dob: null, address: null };
    const extra: Record<string, string> = {};
    for (const field of FIELD_LIBRARY) {
      const raw = data.values[field];
      if (raw === undefined || raw === "") continue;
      const column = COLUMN_FOR_FIELD[field];
      if (column) columns[column] = raw;
      else if (field !== "Chapter") extra[field] = raw;
    }

    if (!columns.name) throw new Error("Name is required.");

    await sql`
      INSERT INTO public.members (community_id, chapter_id, name, email, phone, whatsapp, dob, address, extra, status)
      VALUES (
        ${data.communityId}::uuid,
        ${data.chapterId ?? null},
        ${columns.name},
        ${columns.email},
        ${columns.phone},
        ${columns.whatsapp},
        ${columns.dob ? columns.dob : null}::date,
        ${columns.address},
        ${JSON.stringify(extra)}::jsonb,
        'pending'
      )
    `;

    return { ok: true };
  });
