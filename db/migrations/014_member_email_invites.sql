-- Tracks admin-sent email invites (Invite members / sendInvites) so the
-- public join form can tell "this person was personally invited by the
-- admin" apart from "this person found the public join link on their own."
-- Invited applicants skip the pending-approval queue and go active
-- immediately; organic submissions still require manual review.
CREATE TABLE IF NOT EXISTS public.member_email_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS member_email_invites_unique
  ON public.member_email_invites (community_id, lower(email));
