-- Replaces the old localStorage-only Call Tree prototype (src/lib/call-tree-store.ts)
-- with real, community-scoped storage.
--
-- Feedback tokens are stored in plaintext (not hashed, unlike
-- member_invites.token_hash) — deliberately: they only grant the ability to
-- submit a one-line wellbeing check-in for a single pairing slot, not
-- account or payment access, so the extra hashing step isn't worth the
-- lookup complexity here.
CREATE TABLE IF NOT EXISTS public.call_tree_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  chapter_id uuid REFERENCES public.chapters(id) ON DELETE SET NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz,
  closed_at timestamptz
);
CREATE INDEX IF NOT EXISTS call_tree_sessions_community_idx ON public.call_tree_sessions(community_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.call_tree_pairings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.call_tree_sessions(id) ON DELETE CASCADE,
  member_a_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  member_b_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  member_c_id uuid REFERENCES public.members(id) ON DELETE CASCADE,
  token_a text NOT NULL UNIQUE,
  token_b text NOT NULL UNIQUE,
  token_c text UNIQUE,
  feedback_a_status text CHECK (feedback_a_status IN ('doing_great', 'not_sure', 'needs_help')),
  feedback_a_notes text,
  feedback_a_submitted_at timestamptz,
  feedback_b_status text CHECK (feedback_b_status IN ('doing_great', 'not_sure', 'needs_help')),
  feedback_b_notes text,
  feedback_b_submitted_at timestamptz,
  feedback_c_status text CHECK (feedback_c_status IN ('doing_great', 'not_sure', 'needs_help')),
  feedback_c_notes text,
  feedback_c_submitted_at timestamptz,
  emailed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS call_tree_pairings_session_idx ON public.call_tree_pairings(session_id);
CREATE INDEX IF NOT EXISTS call_tree_pairings_member_a_idx ON public.call_tree_pairings(member_a_id);
CREATE INDEX IF NOT EXISTS call_tree_pairings_member_b_idx ON public.call_tree_pairings(member_b_id);
CREATE INDEX IF NOT EXISTS call_tree_pairings_member_c_idx ON public.call_tree_pairings(member_c_id);
