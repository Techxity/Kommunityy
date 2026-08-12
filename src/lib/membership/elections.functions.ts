import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { sql, withTransaction } from "@/lib/db/client";
import { requireAuth } from "@/lib/auth/require-auth.server";
import { communityIdForAdmin } from "@/lib/payments/communities.functions";
import { resolveActiveMember } from "./active-member.server";

function toDateStr(v: unknown): string {
  if (!v) return "";
  const d = new Date(v as string);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

// ── Admin ────────────────────────────────────────────────────────────────

// Everything the admin elections page needs in one round trip: the role
// catalogue, the current cycle (most recently created, live or ended), the
// full history of ended cycles, derived current executives, and the active
// member roster to pick candidates from.
export const getElectionsAdminData = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const communityId = await communityIdForAdmin(context.userId, context.activeCommunityId);
    if (!communityId) return { roles: [] as string[], election: null, history: [], currentExecutives: [], memberOptions: [] };

    const communities = await sql`SELECT election_roles FROM public.communities WHERE id = ${communityId}::uuid`;
    const roles = (communities[0]?.election_roles as string[] | undefined) ?? [];

    const memberRows = await sql`
      SELECT id, name FROM public.members WHERE community_id = ${communityId}::uuid AND status = 'active' ORDER BY name ASC
    `;
    const memberOptions = memberRows.map((m) => ({ id: m.id as string, name: m.name as string }));

    const elections = await sql`
      SELECT id, year, status, ends_at, created_at FROM public.elections
      WHERE community_id = ${communityId}::uuid
      ORDER BY created_at DESC
    `;

    const electionIds = elections.map((e) => e.id as string);
    let positions: Record<string, unknown>[] = [];
    let candidateRows: Record<string, unknown>[] = [];
    if (electionIds.length > 0) {
      positions = await sql`
        SELECT id, election_id, role, sort_order FROM public.election_positions
        WHERE election_id = ANY(${electionIds}::uuid[])
        ORDER BY sort_order ASC
      `;
      const positionIds = positions.map((p) => p.id as string);
      if (positionIds.length > 0) {
        candidateRows = await sql`
          SELECT ec.id, ec.position_id, m.id AS member_id, m.name,
            (SELECT count(*)::int FROM public.election_votes v WHERE v.candidate_id = ec.id) AS votes
          FROM public.election_candidates ec
          JOIN public.members m ON m.id = ec.member_id
          WHERE ec.position_id = ANY(${positionIds}::uuid[])
        `;
      }
    }

    function positionsFor(electionId: string) {
      return positions
        .filter((p) => p.election_id === electionId)
        .map((p) => ({
          id: p.id as string,
          role: p.role as string,
          candidates: candidateRows
            .filter((c) => c.position_id === p.id)
            .map((c) => ({ id: c.id as string, memberId: c.member_id as string, name: c.name as string, votes: c.votes as number })),
        }));
    }

    const shaped = elections.map((e) => ({
      id: e.id as string,
      year: e.year as number,
      status: e.status as string,
      endsAt: toDateStr(e.ends_at),
      positions: positionsFor(e.id as string),
    }));

    const current = shaped[0] ?? null;
    const history = shaped.filter((e) => e.status === "ended");

    const lastEnded = history[0];
    const currentExecutives = lastEnded
      ? lastEnded.positions.map((p) => {
          const winner = [...p.candidates].sort((a, b) => b.votes - a.votes)[0];
          return { role: p.role, name: winner?.name ?? "—", year: lastEnded.year };
        })
      : [];

    return { roles, election: current, history, currentExecutives, memberOptions };
  });

export const saveElectionRoles = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((i) => z.object({ roles: z.array(z.string().min(1).max(80)) }).parse(i))
  .handler(async ({ data, context }) => {
    const communityId = await communityIdForAdmin(context.userId, context.activeCommunityId);
    if (!communityId) throw new Error("You don't manage a community yet.");
    await sql`
      UPDATE public.communities SET election_roles = ${JSON.stringify(data.roles)}::jsonb, updated_at = now()
      WHERE id = ${communityId}::uuid
    `;
    return { ok: true };
  });

export const startElectionCycle = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((i) =>
    z
      .object({
        year: z.number().int().min(2000).max(2100),
        endsAt: z.string().min(1),
        positions: z.array(z.object({ role: z.string().min(1).max(80), memberIds: z.array(z.string().uuid()).min(1) })).min(1),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const communityId = await communityIdForAdmin(context.userId, context.activeCommunityId);
    if (!communityId) throw new Error("You don't manage a community yet.");

    const live = await sql`SELECT id FROM public.elections WHERE community_id = ${communityId}::uuid AND status = 'live' LIMIT 1`;
    if (live[0]) throw new Error("End the current election before starting a new cycle.");

    const electionId = crypto.randomUUID();

    // Pre-generate position ids so candidates can reference them, then insert
    // all positions in one statement and all candidates in another — instead
    // of one INSERT per position and per candidate (previously O(positions +
    // candidates) round trips inside the transaction).
    const posIds: string[] = [];
    const posRoles: string[] = [];
    const posOrders: number[] = [];
    const candPosIds: string[] = [];
    const candMemberIds: string[] = [];
    data.positions.forEach((p, i) => {
      const positionId = crypto.randomUUID();
      posIds.push(positionId);
      posRoles.push(p.role);
      posOrders.push(i);
      for (const memberId of p.memberIds) {
        candPosIds.push(positionId);
        candMemberIds.push(memberId);
      }
    });

    await withTransaction((tx) => [
      tx`INSERT INTO public.elections (id, community_id, year, status, ends_at)
         VALUES (${electionId}::uuid, ${communityId}::uuid, ${data.year}, 'live', ${data.endsAt}::date)`,
      tx`INSERT INTO public.election_positions (id, election_id, role, sort_order)
         SELECT id, ${electionId}::uuid, role, ord
         FROM unnest(${posIds}::uuid[], ${posRoles}::text[], ${posOrders}::int[]) AS t(id, role, ord)`,
      tx`INSERT INTO public.election_candidates (position_id, member_id)
         SELECT pos, mem FROM unnest(${candPosIds}::uuid[], ${candMemberIds}::uuid[]) AS t(pos, mem)`,
    ]);
    return { ok: true, electionId };
  });

export const endElection = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((i) => z.object({ electionId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const communityId = await communityIdForAdmin(context.userId, context.activeCommunityId);
    if (!communityId) throw new Error("You don't manage a community yet.");
    await sql`
      UPDATE public.elections SET status = 'ended', ended_at = now()
      WHERE id = ${data.electionId}::uuid AND community_id = ${communityId}::uuid
    `;
    return { ok: true };
  });

export const restartElection = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((i) => z.object({ electionId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const communityId = await communityIdForAdmin(context.userId, context.activeCommunityId);
    if (!communityId) throw new Error("You don't manage a community yet.");
    const rows = await sql`SELECT id FROM public.elections WHERE id = ${data.electionId}::uuid AND community_id = ${communityId}::uuid`;
    if (!rows[0]) throw new Error("Election not found.");
    await sql`
      DELETE FROM public.election_votes WHERE position_id IN (
        SELECT id FROM public.election_positions WHERE election_id = ${data.electionId}::uuid
      )
    `;
    await sql`UPDATE public.elections SET status = 'live', ended_at = NULL WHERE id = ${data.electionId}::uuid`;
    return { ok: true };
  });

export const updateCandidates = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((i) =>
    z
      .object({
        electionId: z.string().uuid(),
        positions: z.array(z.object({ positionId: z.string().uuid(), memberIds: z.array(z.string().uuid()) })),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const communityId = await communityIdForAdmin(context.userId, context.activeCommunityId);
    if (!communityId) throw new Error("You don't manage a community yet.");
    const rows = await sql`SELECT status FROM public.elections WHERE id = ${data.electionId}::uuid AND community_id = ${communityId}::uuid`;
    const election = rows[0];
    if (!election) throw new Error("Election not found.");
    if (election.status === "live") throw new Error("End the election before editing candidates.");

    // Only positions that genuinely belong to THIS election may be touched.
    // Without this, a caller could pass their own electionId (to pass the
    // ownership check above) alongside another community's positionIds and
    // rewrite that community's candidate list — a cross-tenant tampering IDOR.
    const ownPositions = await sql`
      SELECT id FROM public.election_positions WHERE election_id = ${data.electionId}::uuid
    `;
    const validPositionIds = new Set(ownPositions.map((r) => r.id as string));

    // Likewise, candidates may only be community members — reject any memberId
    // that isn't an active member of this community.
    const incomingMemberIds = Array.from(new Set(data.positions.flatMap((p) => p.memberIds)));
    const validMemberIds = new Set<string>();
    if (incomingMemberIds.length > 0) {
      const memberRows = await sql`
        SELECT id FROM public.members
        WHERE community_id = ${communityId}::uuid AND id = ANY(${incomingMemberIds}::uuid[])
      `;
      for (const r of memberRows) validMemberIds.add(r.id as string);
    }

    for (const p of data.positions) {
      if (!validPositionIds.has(p.positionId)) {
        throw new Error("One or more positions don't belong to this election.");
      }
    }

    // Flatten to (position_id, member_id) pairs, dropping members that aren't
    // valid for this community. Then clear all affected positions and re-insert
    // every pair in one transaction — atomic, and two statements instead of a
    // delete + insert per candidate.
    const clearIds = data.positions.map((p) => p.positionId);
    const pairPos: string[] = [];
    const pairMem: string[] = [];
    for (const p of data.positions) {
      for (const memberId of p.memberIds) {
        if (!validMemberIds.has(memberId)) continue;
        pairPos.push(p.positionId);
        pairMem.push(memberId);
      }
    }

    await withTransaction((tx) => {
      const stmts = [
        tx`DELETE FROM public.election_candidates WHERE position_id = ANY(${clearIds}::uuid[])`,
      ];
      if (pairPos.length > 0) {
        stmts.push(
          tx`INSERT INTO public.election_candidates (position_id, member_id)
             SELECT pos, mem FROM unnest(${pairPos}::uuid[], ${pairMem}::uuid[]) AS t(pos, mem)`,
        );
      }
      return stmts;
    });
    return { ok: true };
  });

// ── Member voting ───────────────────────────────────────────────────────

type BallotPosition = {
  id: string;
  role: string;
  candidates: { id: string; name: string }[];
  myVote: string | null;
};

export const getMyBallot = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const voter = await resolveActiveMember(context.userId, context.activeCommunityId);
    if (!voter) return null;

    const elections = await sql`
      SELECT id, year, status, ends_at FROM public.elections
      WHERE community_id = ${voter.communityId}::uuid AND status = 'live'
      ORDER BY created_at DESC LIMIT 1
    `;
    const election = elections[0];
    if (!election) return { election: null, positions: [] as BallotPosition[] };

    const positions = await sql`
      SELECT id, role, sort_order FROM public.election_positions WHERE election_id = ${election.id}::uuid ORDER BY sort_order ASC
    `;
    const positionIds = positions.map((p) => p.id as string);

    const candidates =
      positionIds.length > 0
        ? await sql`
            SELECT ec.id, ec.position_id, m.name
            FROM public.election_candidates ec JOIN public.members m ON m.id = ec.member_id
            WHERE ec.position_id = ANY(${positionIds}::uuid[])
          `
        : [];

    const myVotes =
      positionIds.length > 0
        ? await sql`
            SELECT position_id, candidate_id FROM public.election_votes
            WHERE voter_member_id = ${voter.memberId}::uuid AND position_id = ANY(${positionIds}::uuid[])
          `
        : [];
    const votedByPosition = new Map(myVotes.map((v) => [v.position_id as string, v.candidate_id as string]));

    return {
      election: {
        id: election.id as string,
        year: election.year as number,
        status: election.status as string,
        endsAt: toDateStr(election.ends_at),
      },
      positions: positions.map((p) => ({
        id: p.id as string,
        role: p.role as string,
        candidates: candidates
          .filter((c) => c.position_id === p.id)
          .map((c) => ({ id: c.id as string, name: c.name as string })),
        myVote: votedByPosition.get(p.id as string) ?? null,
      })),
    };
  });

// Every election cycle in the member's community (not just the live one),
// with the member's own selections and — only once a cycle has ended —
// the final vote tallies. Tallies are withheld for a still-live election so
// members can't see a running count while voting is open; that view is
// admin-only via getElectionsAdminData.
export const getMyElectionHistory = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const voter = await resolveActiveMember(context.userId, context.activeCommunityId);
    if (!voter) return [];

    const elections = await sql`
      SELECT id, year, status, ends_at FROM public.elections
      WHERE community_id = ${voter.communityId}::uuid
      ORDER BY created_at DESC
    `;
    if (elections.length === 0) return [];
    const electionIds = elections.map((e) => e.id as string);

    const positions = await sql`
      SELECT id, election_id, role, sort_order FROM public.election_positions
      WHERE election_id = ANY(${electionIds}::uuid[])
      ORDER BY sort_order ASC
    `;
    const positionIds = positions.map((p) => p.id as string);

    const candidates =
      positionIds.length > 0
        ? await sql`
            SELECT ec.id, ec.position_id, m.name,
              (SELECT count(*)::int FROM public.election_votes v WHERE v.candidate_id = ec.id) AS votes
            FROM public.election_candidates ec
            JOIN public.members m ON m.id = ec.member_id
            WHERE ec.position_id = ANY(${positionIds}::uuid[])
          `
        : [];

    const myVotes =
      positionIds.length > 0
        ? await sql`
            SELECT position_id, candidate_id FROM public.election_votes
            WHERE voter_member_id = ${voter.memberId}::uuid AND position_id = ANY(${positionIds}::uuid[])
          `
        : [];
    const votedByPosition = new Map(myVotes.map((v) => [v.position_id as string, v.candidate_id as string]));

    return elections.map((e) => {
      const ended = e.status === "ended";
      const positionsForElection = positions
        .filter((p) => p.election_id === e.id)
        .map((p) => {
          const cands = candidates
            .filter((c) => c.position_id === p.id)
            .map((c) => ({
              id: c.id as string,
              name: c.name as string,
              votes: ended ? (c.votes as number) : null,
            }));
          const myVoteCandidateId = votedByPosition.get(p.id as string) ?? null;
          const myVoteName = myVoteCandidateId ? cands.find((c) => c.id === myVoteCandidateId)?.name ?? null : null;
          return { id: p.id as string, role: p.role as string, candidates: cands, myVoteCandidateId, myVoteName };
        });
      return {
        id: e.id as string,
        year: e.year as number,
        status: e.status as string,
        endsAt: toDateStr(e.ends_at),
        positions: positionsForElection,
      };
    });
  });

export const submitBallot = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((i) => z.object({ votes: z.record(z.string().uuid(), z.string().uuid()) }).parse(i))
  .handler(async ({ data, context }) => {
    const voter = await resolveActiveMember(context.userId, context.activeCommunityId);
    if (!voter) throw new Error("You need an active membership to vote.");

    const positionIds = Object.keys(data.votes);
    if (positionIds.length === 0) return { ok: true, cast: 0 };

    const validPositions = await sql`
      SELECT ep.id FROM public.election_positions ep
      JOIN public.elections e ON e.id = ep.election_id
      WHERE ep.id = ANY(${positionIds}::uuid[]) AND e.community_id = ${voter.communityId}::uuid AND e.status = 'live'
    `;
    const validIds = new Set(validPositions.map((r) => r.id as string));

    let cast = 0;
    for (const positionId of positionIds) {
      if (!validIds.has(positionId)) continue;
      const candidateId = data.votes[positionId];
      const candidateRows = await sql`
        SELECT id FROM public.election_candidates WHERE id = ${candidateId}::uuid AND position_id = ${positionId}::uuid
      `;
      if (!candidateRows[0]) continue;
      const result = await sql`
        INSERT INTO public.election_votes (position_id, candidate_id, voter_member_id)
        VALUES (${positionId}::uuid, ${candidateId}::uuid, ${voter.memberId}::uuid)
        ON CONFLICT (position_id, voter_member_id) DO NOTHING
        RETURNING id
      `;
      if (result[0]) cast++;
    }

    return { ok: true, cast };
  });
