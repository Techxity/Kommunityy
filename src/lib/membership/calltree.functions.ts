import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createServerOnlyFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { sql } from "@/lib/db/client";
import { requireAuth } from "@/lib/auth/require-auth.server";
import { communityIdForAdmin } from "@/lib/payments/communities.functions";
import { resolveActiveMember } from "./active-member.server";
import { sendEmail } from "@/lib/email";
import { callTreePairingEmail } from "@/lib/email-templates";
import { toTimestampIso } from "@/lib/date-only";

const getOrigin = createServerOnlyFn((): string => new URL(getRequest().url).origin);

const FEEDBACK_STATUSES = ["doing_great", "not_sure", "needs_help"] as const;

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Same pairing shape the old localStorage prototype used: shuffle, pair
// consecutively, and if there's an odd one out, fold them into the last
// pair as a triad rather than leaving anyone unpaired.
function buildPairings(memberIds: string[]): { a: string; b: string; c?: string }[] {
  const ids = shuffle(memberIds);
  const out: { a: string; b: string; c?: string }[] = [];
  for (let i = 0; i < ids.length; i += 2) {
    const a = ids[i];
    const b = ids[i + 1];
    if (b === undefined) {
      if (out.length > 0) out[out.length - 1].c = a;
      else out.push({ a, b: a }); // solo — shouldn't happen given the >=2 check at the call site
    } else {
      out.push({ a, b });
    }
  }
  return out;
}

// ── Admin: session list + detail ─────────────────────────────────────────

export const listCallTreeSessions = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const communityId = await communityIdForAdmin(context.userId);
    if (!communityId) return [];

    const sessions = await sql`
      SELECT s.id, s.name, s.status, s.created_at,
        count(p.id) AS pair_count,
        count(p.id) FILTER (WHERE p.member_c_id IS NOT NULL) AS triad_count,
        count(*) FILTER (WHERE p.feedback_a_status IS NOT NULL) AS fb_a,
        count(*) FILTER (WHERE p.feedback_b_status IS NOT NULL) AS fb_b,
        count(*) FILTER (WHERE p.member_c_id IS NOT NULL AND p.feedback_c_status IS NOT NULL) AS fb_c,
        count(*) FILTER (WHERE p.feedback_a_status = 'needs_help') AS needs_a,
        count(*) FILTER (WHERE p.feedback_b_status = 'needs_help') AS needs_b,
        count(*) FILTER (WHERE p.feedback_c_status = 'needs_help') AS needs_c
      FROM public.call_tree_sessions s
      LEFT JOIN public.call_tree_pairings p ON p.session_id = s.id
      WHERE s.community_id = ${communityId}::uuid
      GROUP BY s.id
      ORDER BY s.created_at DESC
    `;

    return sessions.map((s) => {
      const pairCount = Number(s.pair_count ?? 0);
      const triadCount = Number(s.triad_count ?? 0);
      const total = pairCount * 2 + triadCount;
      const responses = Number(s.fb_a ?? 0) + Number(s.fb_b ?? 0) + Number(s.fb_c ?? 0);
      const needsHelp = Number(s.needs_a ?? 0) + Number(s.needs_b ?? 0) + Number(s.needs_c ?? 0);
      return {
        id: s.id as string,
        name: s.name as string,
        status: s.status as "draft" | "active" | "closed",
        createdAt: toTimestampIso(s.created_at),
        pairCount,
        totalMembers: total,
        responses,
        needsHelp,
      };
    });
  });

async function loadSessionDetail(sessionId: string, communityId: string) {
  const sessions = await sql`
    SELECT id, name, status, created_at, activated_at, closed_at
    FROM public.call_tree_sessions
    WHERE id = ${sessionId}::uuid AND community_id = ${communityId}::uuid
  `;
  const session = sessions[0];
  if (!session) return null;

  const pairings = await sql`
    SELECT p.*, a.name AS a_name, a.email AS a_email, a.phone AS a_phone,
           b.name AS b_name, b.email AS b_email, b.phone AS b_phone,
           c.name AS c_name, c.email AS c_email, c.phone AS c_phone
    FROM public.call_tree_pairings p
    JOIN public.members a ON a.id = p.member_a_id
    JOIN public.members b ON b.id = p.member_b_id
    LEFT JOIN public.members c ON c.id = p.member_c_id
    WHERE p.session_id = ${sessionId}::uuid
    ORDER BY p.created_at ASC
  `;

  return {
    id: session.id as string,
    name: session.name as string,
    status: session.status as "draft" | "active" | "closed",
    createdAt: toTimestampIso(session.created_at),
    pairings: pairings.map((p) => ({
      id: p.id as string,
      a: { id: p.member_a_id as string, name: p.a_name as string, email: (p.a_email as string | null) ?? "", phone: (p.a_phone as string | null) ?? "", token: p.token_a as string, feedback: p.feedback_a_status ? { status: p.feedback_a_status as string, notes: (p.feedback_a_notes as string | null) ?? "", submittedAt: toTimestampIso(p.feedback_a_submitted_at) } : null },
      b: { id: p.member_b_id as string, name: p.b_name as string, email: (p.b_email as string | null) ?? "", phone: (p.b_phone as string | null) ?? "", token: p.token_b as string, feedback: p.feedback_b_status ? { status: p.feedback_b_status as string, notes: (p.feedback_b_notes as string | null) ?? "", submittedAt: toTimestampIso(p.feedback_b_submitted_at) } : null },
      c: p.member_c_id
        ? { id: p.member_c_id as string, name: p.c_name as string, email: (p.c_email as string | null) ?? "", phone: (p.c_phone as string | null) ?? "", token: p.token_c as string, feedback: p.feedback_c_status ? { status: p.feedback_c_status as string, notes: (p.feedback_c_notes as string | null) ?? "", submittedAt: toTimestampIso(p.feedback_c_submitted_at) } : null }
        : null,
    })),
  };
}

export const getCallTreeSession = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((i) => z.object({ sessionId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const communityId = await communityIdForAdmin(context.userId);
    if (!communityId) return null;
    return loadSessionDetail(data.sessionId, communityId);
  });

// ── Admin: create / regenerate / swap ────────────────────────────────────

export const createCallTreeSession = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((i) =>
    z
      .object({
        name: z.string().min(1).max(160),
        chapterId: z.string().uuid().optional(),
        memberIds: z.array(z.string().uuid()).min(2),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const communityId = await communityIdForAdmin(context.userId);
    if (!communityId) throw new Error("You don't manage a community yet.");

    // Only accept members that genuinely belong to this community and are
    // active — prevents pairing in someone from another tenant via a
    // tampered request.
    const valid = await sql`
      SELECT id FROM public.members
      WHERE community_id = ${communityId}::uuid AND status = 'active' AND id = ANY(${data.memberIds}::uuid[])
    `;
    const validIds = valid.map((r) => r.id as string);
    if (validIds.length < 2) throw new Error("Pick at least 2 active members.");

    const sessions = await sql`
      INSERT INTO public.call_tree_sessions (community_id, chapter_id, name, status)
      VALUES (${communityId}::uuid, ${data.chapterId ?? null}, ${data.name}, 'draft')
      RETURNING id
    `;
    const sessionId = sessions[0].id as string;

    const pairs = buildPairings(validIds);
    for (const p of pairs) {
      await sql`
        INSERT INTO public.call_tree_pairings (session_id, member_a_id, member_b_id, member_c_id, token_a, token_b, token_c)
        VALUES (${sessionId}::uuid, ${p.a}::uuid, ${p.b}::uuid, ${p.c ?? null}, ${randomToken()}, ${randomToken()}, ${p.c ? randomToken() : null})
      `;
    }

    return { ok: true, sessionId };
  });

export const regenerateCallTreePairings = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((i) => z.object({ sessionId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const communityId = await communityIdForAdmin(context.userId);
    if (!communityId) throw new Error("You don't manage a community yet.");

    const sessions = await sql`SELECT status FROM public.call_tree_sessions WHERE id = ${data.sessionId}::uuid AND community_id = ${communityId}::uuid`;
    if (!sessions[0]) throw new Error("Call tree not found.");
    if (sessions[0].status !== "draft") throw new Error("Only draft call trees can be reshuffled.");

    const existing = await sql`
      SELECT member_a_id, member_b_id, member_c_id FROM public.call_tree_pairings WHERE session_id = ${data.sessionId}::uuid
    `;
    const memberIds = existing.flatMap((p) => [p.member_a_id, p.member_b_id, p.member_c_id].filter(Boolean) as string[]);
    if (memberIds.length < 2) throw new Error("Not enough members to reshuffle.");

    await sql`DELETE FROM public.call_tree_pairings WHERE session_id = ${data.sessionId}::uuid`;
    const pairs = buildPairings(memberIds);
    for (const p of pairs) {
      await sql`
        INSERT INTO public.call_tree_pairings (session_id, member_a_id, member_b_id, member_c_id, token_a, token_b, token_c)
        VALUES (${data.sessionId}::uuid, ${p.a}::uuid, ${p.b}::uuid, ${p.c ?? null}, ${randomToken()}, ${randomToken()}, ${p.c ? randomToken() : null})
      `;
    }
    return { ok: true };
  });

// ── Admin: activate (email everyone) / close ─────────────────────────────

export const activateCallTreeSession = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((i) => z.object({ sessionId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const communityId = await communityIdForAdmin(context.userId);
    if (!communityId) throw new Error("You don't manage a community yet.");

    const sessions = await sql`
      SELECT s.status, c.name AS community_name
      FROM public.call_tree_sessions s
      JOIN public.communities c ON c.id = s.community_id
      WHERE s.id = ${data.sessionId}::uuid AND s.community_id = ${communityId}::uuid
    `;
    const session = sessions[0];
    if (!session) throw new Error("Call tree not found.");
    if (session.status !== "draft") throw new Error("This call tree has already been activated.");

    const communityName = session.community_name as string;
    const origin = getOrigin();

    const pairings = await sql`
      SELECT p.id, p.token_a, p.token_b, p.token_c,
             a.name AS a_name, a.email AS a_email,
             b.name AS b_name, b.email AS b_email,
             c.name AS c_name, c.email AS c_email
      FROM public.call_tree_pairings p
      JOIN public.members a ON a.id = p.member_a_id
      JOIN public.members b ON b.id = p.member_b_id
      LEFT JOIN public.members c ON c.id = p.member_c_id
      WHERE p.session_id = ${data.sessionId}::uuid
    `;

    const sendJobs: Promise<unknown>[] = [];
    for (const p of pairings) {
      const slots = [
        { name: p.a_name as string, email: p.a_email as string | null, token: p.token_a as string, otherNames: [p.b_name as string, p.c_name as string | undefined].filter(Boolean) as string[] },
        { name: p.b_name as string, email: p.b_email as string | null, token: p.token_b as string, otherNames: [p.a_name as string, p.c_name as string | undefined].filter(Boolean) as string[] },
        ...(p.token_c
          ? [{ name: p.c_name as string, email: p.c_email as string | null, token: p.token_c as string, otherNames: [p.a_name as string, p.b_name as string] }]
          : []),
      ];
      for (const slot of slots) {
        if (!slot.email) continue;
        sendJobs.push(
          sendEmail({
            to: slot.email,
            subject: `Call tree: you're paired with ${slot.otherNames.join(" and ")}`,
            fromName: communityName,
            html: callTreePairingEmail({
              memberName: slot.name,
              communityName,
              partnerNames: slot.otherNames,
              feedbackUrl: `${origin}/feedback/${slot.token}`,
            }),
          }),
        );
      }
    }
    await Promise.all(sendJobs);

    await sql`
      UPDATE public.call_tree_sessions SET status = 'active', activated_at = now() WHERE id = ${data.sessionId}::uuid
    `;
    await sql`
      UPDATE public.call_tree_pairings SET emailed_at = now() WHERE session_id = ${data.sessionId}::uuid
    `;

    return { ok: true, emailsSent: sendJobs.length };
  });

export const closeCallTreeSession = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((i) => z.object({ sessionId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const communityId = await communityIdForAdmin(context.userId);
    if (!communityId) throw new Error("You don't manage a community yet.");
    await sql`
      UPDATE public.call_tree_sessions SET status = 'closed', closed_at = now()
      WHERE id = ${data.sessionId}::uuid AND community_id = ${communityId}::uuid AND status = 'active'
    `;
    return { ok: true };
  });

// ── Member: my call tree history ─────────────────────────────────────────

export const getMyCallTreeHistory = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const me = await resolveActiveMember(context.userId, context.activeCommunityId);
    if (!me) return [];

    const rows = await sql`
      SELECT p.id, p.member_a_id, p.member_b_id, p.member_c_id,
             p.token_a, p.token_b, p.token_c,
             p.feedback_a_status, p.feedback_a_notes, p.feedback_a_submitted_at,
             p.feedback_b_status, p.feedback_b_notes, p.feedback_b_submitted_at,
             p.feedback_c_status, p.feedback_c_notes, p.feedback_c_submitted_at,
             s.id AS session_id, s.name AS session_name, s.status AS session_status,
             a.name AS a_name, a.email AS a_email, a.phone AS a_phone,
             b.name AS b_name, b.email AS b_email, b.phone AS b_phone,
             c.name AS c_name, c.email AS c_email, c.phone AS c_phone
      FROM public.call_tree_pairings p
      JOIN public.call_tree_sessions s ON s.id = p.session_id
      JOIN public.members a ON a.id = p.member_a_id
      JOIN public.members b ON b.id = p.member_b_id
      LEFT JOIN public.members c ON c.id = p.member_c_id
      WHERE s.community_id = ${me.communityId}::uuid
        AND (p.member_a_id = ${me.memberId}::uuid OR p.member_b_id = ${me.memberId}::uuid OR p.member_c_id = ${me.memberId}::uuid)
      ORDER BY s.created_at DESC
    `;

    return rows.map((r) => {
      const slot = r.member_a_id === me.memberId ? "A" : r.member_b_id === me.memberId ? "B" : "C";
      const token = slot === "A" ? r.token_a : slot === "B" ? r.token_b : r.token_c;
      const feedback =
        slot === "A"
          ? r.feedback_a_status
            ? { status: r.feedback_a_status as string, notes: (r.feedback_a_notes as string | null) ?? "", submittedAt: toTimestampIso(r.feedback_a_submitted_at) }
            : null
          : slot === "B"
          ? r.feedback_b_status
            ? { status: r.feedback_b_status as string, notes: (r.feedback_b_notes as string | null) ?? "", submittedAt: toTimestampIso(r.feedback_b_submitted_at) }
            : null
          : r.feedback_c_status
          ? { status: r.feedback_c_status as string, notes: (r.feedback_c_notes as string | null) ?? "", submittedAt: toTimestampIso(r.feedback_c_submitted_at) }
          : null;
      const partners = [
        r.member_a_id !== me.memberId
          ? { id: r.member_a_id as string, name: r.a_name as string, email: (r.a_email as string | null) ?? "", phone: (r.a_phone as string | null) ?? "" }
          : null,
        r.member_b_id !== me.memberId
          ? { id: r.member_b_id as string, name: r.b_name as string, email: (r.b_email as string | null) ?? "", phone: (r.b_phone as string | null) ?? "" }
          : null,
        r.member_c_id && r.member_c_id !== me.memberId
          ? { id: r.member_c_id as string, name: r.c_name as string, email: (r.c_email as string | null) ?? "", phone: (r.c_phone as string | null) ?? "" }
          : null,
      ].filter((p): p is { id: string; name: string; email: string; phone: string } => p !== null);

      return {
        pairingId: r.id as string,
        sessionId: r.session_id as string,
        sessionName: r.session_name as string,
        sessionStatus: r.session_status as "draft" | "active" | "closed",
        partners,
        token: token as string,
        feedback,
      };
    });
  });

// ── Public: feedback link (accessed from the emailed pairing link) ───────

export const getFeedbackInfo = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ token: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const rows = await sql`
      SELECT p.id, p.member_a_id, p.member_b_id, p.member_c_id,
             p.token_a, p.token_b, p.token_c,
             p.feedback_a_status, p.feedback_a_notes,
             p.feedback_b_status, p.feedback_b_notes,
             p.feedback_c_status, p.feedback_c_notes,
             a.id AS a_id, a.name AS a_name, a.email AS a_email, a.phone AS a_phone,
             b.id AS b_id, b.name AS b_name, b.email AS b_email, b.phone AS b_phone,
             c.id AS c_id, c.name AS c_name, c.email AS c_email, c.phone AS c_phone,
             comm.name AS community_name
      FROM public.call_tree_pairings p
      JOIN public.call_tree_sessions s ON s.id = p.session_id
      JOIN public.communities comm ON comm.id = s.community_id
      JOIN public.members a ON a.id = p.member_a_id
      JOIN public.members b ON b.id = p.member_b_id
      LEFT JOIN public.members c ON c.id = p.member_c_id
      WHERE p.token_a = ${data.token} OR p.token_b = ${data.token} OR p.token_c = ${data.token}
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) return null;

    const slot = row.token_a === data.token ? "A" : row.token_b === data.token ? "B" : "C";
    const self = slot === "A" ? { id: row.a_id, name: row.a_name } : slot === "B" ? { id: row.b_id, name: row.b_name } : { id: row.c_id, name: row.c_name };
    const existing =
      slot === "A" ? row.feedback_a_status : slot === "B" ? row.feedback_b_status : row.feedback_c_status;
    const existingNotes =
      slot === "A" ? row.feedback_a_notes : slot === "B" ? row.feedback_b_notes : row.feedback_c_notes;

    const all = [
      { id: row.a_id as string, name: row.a_name as string, email: (row.a_email as string | null) ?? "", phone: (row.a_phone as string | null) ?? "" },
      { id: row.b_id as string, name: row.b_name as string, email: (row.b_email as string | null) ?? "", phone: (row.b_phone as string | null) ?? "" },
      ...(row.c_id ? [{ id: row.c_id as string, name: row.c_name as string, email: (row.c_email as string | null) ?? "", phone: (row.c_phone as string | null) ?? "" }] : []),
    ];
    const partners = all.filter((m) => m.id !== self.id);

    return {
      selfName: self.name as string,
      communityName: row.community_name as string,
      partners,
      existingFeedback: existing ? { status: existing as string, notes: (existingNotes as string | null) ?? "" } : null,
    };
  });

export const submitCallTreeFeedback = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z
      .object({
        token: z.string().min(10),
        status: z.enum(FEEDBACK_STATUSES),
        notes: z.string().max(2000).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const rows = await sql`
      SELECT token_a, token_b, token_c FROM public.call_tree_pairings
      WHERE token_a = ${data.token} OR token_b = ${data.token} OR token_c = ${data.token}
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) throw new Error("This feedback link is invalid or has expired.");

    const slot = row.token_a === data.token ? "a" : row.token_b === data.token ? "b" : "c";
    const notes = data.notes?.trim() || null;

    if (slot === "a") {
      await sql`UPDATE public.call_tree_pairings SET feedback_a_status = ${data.status}, feedback_a_notes = ${notes}, feedback_a_submitted_at = now() WHERE token_a = ${data.token}`;
    } else if (slot === "b") {
      await sql`UPDATE public.call_tree_pairings SET feedback_b_status = ${data.status}, feedback_b_notes = ${notes}, feedback_b_submitted_at = now() WHERE token_b = ${data.token}`;
    } else {
      await sql`UPDATE public.call_tree_pairings SET feedback_c_status = ${data.status}, feedback_c_notes = ${notes}, feedback_c_submitted_at = now() WHERE token_c = ${data.token}`;
    }

    return { ok: true };
  });
