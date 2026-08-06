-- Adds real trial tracking to communities. Previously the admin dashboard's
-- "N days left in your trial" was a hardcoded placeholder — this makes it
-- real. Safe to re-run.

ALTER TABLE public.communities
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;

-- Backfill any community created before this column existed (e.g. one
-- created via signup while this migration hadn't run yet) with a 14-day
-- trial counted from its creation date.
UPDATE public.communities
SET trial_ends_at = created_at + interval '14 days'
WHERE trial_ends_at IS NULL;
