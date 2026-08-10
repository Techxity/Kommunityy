-- Nearly every member-facing query filters public.members by user_id
-- (activeMemberFor, getMyProfile, listMyBroadcasts, dues/elections/call-tree
-- lookups) but there was no index on it — a sequential scan on the hottest
-- member path. CONCURRENTLY so it doesn't lock the table on a live database.
--
-- NOTE: CREATE INDEX CONCURRENTLY cannot run inside a transaction block. If
-- your migration runner wraps statements in a transaction, run this file on
-- its own (e.g. psql -f), not inside a BEGIN/COMMIT batch.
CREATE INDEX CONCURRENTLY IF NOT EXISTS members_user_id_idx
  ON public.members(user_id)
  WHERE user_id IS NOT NULL;
