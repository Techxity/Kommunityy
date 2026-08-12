import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { sql } from "@/lib/db/client";
import { assertNotRateLimited, recordAttempt, clientIp } from "@/lib/auth/rate-limit.server";
import { FIELD_LIBRARY } from "@/lib/onboarding-fields";
import { ensureMemberInvite } from "./member-invite.server";
import { assertMemberCapacity } from "./members.functions";

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

    const communities = await sql`SELECT id, suspended FROM public.communities WHERE id = ${data.communityId}::uuid LIMIT 1`;
    if (!communities[0]) throw new Error("This community doesn't exist or is no longer accepting applications.");
    if (communities[0].suspended) throw new Error("This community isn't accepting applications right now.");

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

    // Guard against a duplicate membership in THIS community. The public form
    // has no dedupe, so without this a person already in the community (or with
    // an application still pending) could submit again and create a second
    // member row. Scoped to active/pending only — someone previously rejected
    // (or removed/inactive) is deliberately allowed to re-apply.
    if (columns.email) {
      const dupe = await sql`
        SELECT status FROM public.members
        WHERE community_id = ${data.communityId}::uuid
          AND lower(email) = lower(${columns.email})
          AND status IN ('active', 'pending')
        LIMIT 1
      `;
      if (dupe[0]) {
        throw new Error(
          dupe[0].status === "active"
            ? "You're already a member of this community. Sign in with your existing account instead."
            : "You've already applied to this community — your application is pending review. Please wait for your admin to approve it.",
        );
      }
    }

    // If this address was personally invited by the admin (sendInvites), and
    // the community still has room on its plan, skip the pending-approval
    // queue entirely: go active immediately and send the password-setup
    // email right away. An admin already vouched for this specific person
    // by inviting them — making them wait in the same review queue as an
    // anonymous public submission was the actual bug being fixed here.
    // Organic submissions (no matching invite) keep the original behavior.
    let autoApproved = false;
    if (columns.email) {
      const invite = await sql`
        SELECT id FROM public.member_email_invites
        WHERE community_id = ${data.communityId}::uuid
          AND lower(email) = lower(${columns.email})
          AND expires_at > now()
          AND consumed_at IS NULL
        LIMIT 1
      `;
      if (invite[0]) {
        try {
          await assertMemberCapacity(data.communityId, 1);
          autoApproved = true;
        } catch {
          // Plan's full — fall back to a normal pending application rather
          // than blocking the applicant with an error.
        }
      }
    }

    const joinedAt = autoApproved ? new Date().toISOString() : null;
    const inserted = await sql`
      INSERT INTO public.members (community_id, chapter_id, name, email, phone, whatsapp, dob, address, extra, status, joined_at)
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
        ${autoApproved ? "active" : "pending"},
        ${joinedAt}::timestamptz
      )
      RETURNING id
    `;

    if (autoApproved) {
      const memberId = inserted[0]?.id as string | undefined;
      await sql`
        UPDATE public.member_email_invites SET consumed_at = now()
        WHERE community_id = ${data.communityId}::uuid AND lower(email) = lower(${columns.email})
      `;
      if (memberId) await ensureMemberInvite(memberId).catch(() => {});
    }

    return { ok: true, autoApproved };
  });
