-- Subscription plans can be paid monthly or yearly (yearly = 10× the monthly
-- price, i.e. 2 months free). Record how many months each plan payment covers
-- so the "renews on" estimate advances by the right amount.
ALTER TABLE public.plan_payments
  ADD COLUMN IF NOT EXISTS period_months int NOT NULL DEFAULT 1;
