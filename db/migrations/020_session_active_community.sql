-- Which community a member is currently viewing, per session. A single
-- account can be a member of several communities; this pins the member portal
-- to one at a time (set on login via the community's /l/<slug> link, and
-- changeable with the in-app switcher). NULL = fall back to the earliest
-- membership. ON DELETE SET NULL so removing a community doesn't wipe sessions.
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS active_community_id uuid REFERENCES public.communities(id) ON DELETE SET NULL;
