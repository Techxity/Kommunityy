import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { sql } from "@/lib/db/client";
import { requireAuth } from "@/lib/auth/require-auth.server";
import { communityIdForAdmin } from "@/lib/payments/communities.functions";
import { toDateOnlyString } from "@/lib/date-only";

const MeetingDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const getAttendanceData = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((i) => z.object({ sessionId: z.string().uuid().nullable().optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const communityId = await communityIdForAdmin(context.userId, context.activeCommunityId);
    if (!communityId) return { sessions: [], members: [], records: [], selectedSessionId: null };

    const sessionRows = await sql`
      SELECT id, meeting_date, title FROM public.attendance_sessions
      WHERE community_id = ${communityId}::uuid
      ORDER BY meeting_date DESC, created_at DESC
      LIMIT 52
    `;
    const sessions = sessionRows.map((row) => ({
      id: row.id as string,
      date: toDateOnlyString(row.meeting_date),
      title: row.title as string,
    }));
    const selectedSessionId = sessions.some((session) => session.id === data.sessionId)
      ? data.sessionId!
      : (sessions[0]?.id ?? null);

    const memberRows = await sql`
      SELECT id, name, chapter_id, email, phone FROM public.members
      WHERE community_id = ${communityId}::uuid AND status = 'active'
      ORDER BY name ASC
    `;
    const members = memberRows.map((row) => ({
      id: row.id as string,
      name: row.name as string,
      chapterId: (row.chapter_id as string | null) ?? null,
      email: (row.email as string | null) ?? "",
      phone: (row.phone as string | null) ?? "",
    }));

    const recordRows = selectedSessionId
      ? await sql`
          SELECT member_id, status FROM public.attendance_records
          WHERE session_id = ${selectedSessionId}::uuid
        `
      : [];
    const records = recordRows.map((row) => ({
      memberId: row.member_id as string,
      status: row.status as string,
    }));

    return { sessions, members, records, selectedSessionId };
  });

export const createAttendanceSession = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((i) =>
    z
      .object({
        date: MeetingDate,
        title: z.string().trim().min(1).max(120).default("Weekly gathering"),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const communityId = await communityIdForAdmin(context.userId, context.activeCommunityId);
    if (!communityId) throw new Error("You don't manage a community yet.");

    const rows = await sql`
      INSERT INTO public.attendance_sessions (community_id, meeting_date, title)
      VALUES (${communityId}::uuid, ${data.date}::date, ${data.title})
      ON CONFLICT (community_id, meeting_date)
      DO UPDATE SET title = EXCLUDED.title
      RETURNING id
    `;
    return { id: rows[0].id as string };
  });

export const saveAttendance = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((i) =>
    z
      .object({
        sessionId: z.string().uuid(),
        records: z
          .array(
            z.object({
              memberId: z.string().uuid(),
              status: z.enum(["present", "absent", "excused"]).nullable(),
            }),
          )
          .max(2000),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const communityId = await communityIdForAdmin(context.userId, context.activeCommunityId);
    if (!communityId) throw new Error("You don't manage a community yet.");

    const sessions = await sql`
      SELECT id FROM public.attendance_sessions
      WHERE id = ${data.sessionId}::uuid AND community_id = ${communityId}::uuid
      LIMIT 1
    `;
    if (!sessions[0]) throw new Error("Meeting session not found.");

    const memberIds = data.records.map((record) => record.memberId);
    if (new Set(memberIds).size !== memberIds.length)
      throw new Error("Each member can only be marked once.");
    if (memberIds.length === 0) return { saved: 0 };

    const validMembers = await sql`
      SELECT id FROM public.members
      WHERE id = ANY(${memberIds}::uuid[])
        AND community_id = ${communityId}::uuid
        AND status = 'active'
    `;
    if (validMembers.length !== memberIds.length)
      throw new Error("One or more members are no longer active in this community.");

    const markedRecords = data.records.filter((record) => record.status !== null);
    if (markedRecords.length > 0) {
      await sql`
        INSERT INTO public.attendance_records (session_id, member_id, status)
        SELECT ${data.sessionId}::uuid, member_id, status
        FROM unnest(${markedRecords.map((record) => record.memberId)}::uuid[], ${markedRecords.map((record) => record.status)}::text[]) AS marks(member_id, status)
        ON CONFLICT (session_id, member_id)
        DO UPDATE SET status = EXCLUDED.status, marked_at = now()
      `;
    }
    const clearedIds = data.records
      .filter((record) => record.status === null)
      .map((record) => record.memberId);
    if (clearedIds.length > 0) {
      await sql`
        DELETE FROM public.attendance_records
        WHERE session_id = ${data.sessionId}::uuid AND member_id = ANY(${clearedIds}::uuid[])
      `;
    }
    return { saved: data.records.length };
  });
