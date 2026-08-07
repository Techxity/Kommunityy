-- Lets the super admin suspend a community (blocks admin/member sign-in and
-- new join applications) from the real Communities page instead of the old
-- local-only prototype toggle. Safe to re-run.

ALTER TABLE public.communities
  ADD COLUMN IF NOT EXISTS suspended boolean NOT NULL DEFAULT false;
