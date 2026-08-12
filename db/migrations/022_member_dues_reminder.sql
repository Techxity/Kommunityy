-- Tracks the last time a member was sent a dues-arrears reminder, so the
-- automated reminder job can throttle itself (only re-remind after a cooldown
-- window) instead of emailing a defaulter every time the daily cron runs.
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS last_dues_reminder_at timestamptz;
