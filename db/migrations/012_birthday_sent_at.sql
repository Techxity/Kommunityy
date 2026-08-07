-- Precise timestamp for the last birthday email a member received (the
-- existing last_birthday_sent_year only supports year-level idempotency,
-- not "sent in the last 30 days" reporting on the admin Overview page).
-- Safe to re-run.

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS last_birthday_sent_at timestamptz;
