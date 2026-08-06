-- Real election cycles + real member voting (previously 100% local React
-- state, reset on every page reload). Safe to re-run.

ALTER TABLE public.communities
  ADD COLUMN IF NOT EXISTS election_roles jsonb NOT NULL
    DEFAULT '["President","Secretary","Treasurer","PRO","Welfare Officer"]'::jsonb;

CREATE TABLE IF NOT EXISTS public.elections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  year int NOT NULL,
  status text NOT NULL DEFAULT 'live' CHECK (status IN ('live', 'ended')),
  ends_at date,
  created_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);
CREATE INDEX IF NOT EXISTS elections_community_id_idx ON public.elections(community_id, year DESC);

CREATE TABLE IF NOT EXISTS public.election_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id uuid NOT NULL REFERENCES public.elections(id) ON DELETE CASCADE,
  role text NOT NULL,
  sort_order int NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS election_positions_election_id_idx ON public.election_positions(election_id);

CREATE TABLE IF NOT EXISTS public.election_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id uuid NOT NULL REFERENCES public.election_positions(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS election_candidates_position_id_idx ON public.election_candidates(position_id);

CREATE TABLE IF NOT EXISTS public.election_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id uuid NOT NULL REFERENCES public.election_positions(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES public.election_candidates(id) ON DELETE CASCADE,
  voter_member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (position_id, voter_member_id)
);
CREATE INDEX IF NOT EXISTS election_votes_candidate_id_idx ON public.election_votes(candidate_id);
