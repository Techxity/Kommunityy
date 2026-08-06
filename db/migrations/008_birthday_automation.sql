-- Tracks the last year a member was sent their automated birthday email,
-- so the daily cron job (scripts/send-birthday-emails.mjs) never double-sends
-- if it runs more than once on the same day. Safe to re-run.

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS last_birthday_sent_year int;
