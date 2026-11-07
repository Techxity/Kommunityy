-- Different dues/rent per member, and transfers recorded against a member.
--
-- A member's price = their custom amount, else their assigned rate, else the
-- plan's default. Rates belong to the community rather than a plan, because
-- saveDuesPlan replaces the plan row on every edit.
--
-- Recorded transfers live in dues_payments so arrears, reminders and history
-- all see them, with provider = 'manual' and settlement_mode = 'direct'. The
-- payout balance view only sums 'platform_held', so money that went straight
-- to the community's own bank account can never be paid out by the platform.
-- Safe to re-run.

ALTER TYPE public.payment_provider ADD VALUE IF NOT EXISTS 'manual';

ALTER TABLE public.dues_payments DROP CONSTRAINT IF EXISTS dues_payments_settlement_mode_check;
ALTER TABLE public.dues_payments
  ADD CONSTRAINT dues_payments_settlement_mode_check
  CHECK (settlement_mode IN ('platform_held', 'subaccount_split', 'direct'));

CREATE TABLE IF NOT EXISTS public.dues_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  name text NOT NULL,
  amount_ngn numeric(12,2) CHECK (amount_ngn > 0),
  amount_usd numeric(12,2) CHECK (amount_usd > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (amount_ngn IS NOT NULL OR amount_usd IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS dues_rates_community_name_idx ON public.dues_rates(community_id, lower(name));

-- dues_pay_token identifies a member on their personal pay link. Short because
-- it goes in reminder texts, where extra characters can cost an extra page.
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS dues_rate_id uuid REFERENCES public.dues_rates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS dues_custom_ngn numeric(12,2) CHECK (dues_custom_ngn > 0),
  ADD COLUMN IF NOT EXISTS dues_custom_usd numeric(12,2) CHECK (dues_custom_usd > 0),
  ADD COLUMN IF NOT EXISTS dues_pay_token text NOT NULL DEFAULT substr(replace(gen_random_uuid()::text, '-', ''), 1, 16);
CREATE UNIQUE INDEX IF NOT EXISTS members_dues_pay_token_idx ON public.members(dues_pay_token);

ALTER TABLE public.dues_payments
  ADD COLUMN IF NOT EXISTS member_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS note text,
  ADD COLUMN IF NOT EXISTS recorded_by uuid REFERENCES public.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS dues_payments_member_id_idx ON public.dues_payments(member_id) WHERE member_id IS NOT NULL;
