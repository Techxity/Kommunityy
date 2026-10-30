-- Phone-only members setting up their login ("Set up account" on /l/{slug})
-- no longer get an account the moment their name + phone match — those two
-- facts aren't secret (call tree, officer lists, exports), so matching them
-- proved nothing. The request is parked here until a community admin approves
-- it. The chosen password is stored only as a PBKDF2 hash and is cleared once
-- the request is decided. Safe to re-run.

CREATE TABLE IF NOT EXISTS public.member_account_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  phone text NOT NULL,
  password_hash text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  decided_by uuid REFERENCES public.users(id) ON DELETE SET NULL
);

-- At most one open request per member: a second submission is refused rather
-- than overwriting the first, so nobody can swap their own password into a
-- request the real member already made.
CREATE UNIQUE INDEX IF NOT EXISTS member_account_claims_one_pending
  ON public.member_account_claims(member_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS member_account_claims_community_status_idx
  ON public.member_account_claims(community_id, status, requested_at DESC);
