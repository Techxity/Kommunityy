-- Multi-month dues: let a single payment cover several billing periods, and
-- record which period it starts from so members can be shown what they're
-- paid through and pick from the following month next time.
--   months        = number of billing periods this one payment covers (>=1)
--   period_start  = first day of the first period covered (NULL for legacy
--                   payments made before this existed)
ALTER TABLE public.dues_payments
  ADD COLUMN IF NOT EXISTS months int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS period_start date;
