-- Real trial defaulting/lifecycle + real plan payments via Paystack.
-- Safe to re-run.

ALTER TABLE public.communities
  ADD COLUMN IF NOT EXISTS trial_warned_2_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_warned_1_at timestamptz;

-- Singleton platform-wide trial configuration (previously a purely local,
-- unsaved panel on the super-admin Plans page).
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id boolean PRIMARY KEY DEFAULT true,
  trial_enabled boolean NOT NULL DEFAULT true,
  trial_days int NOT NULL DEFAULT 14,
  trial_tier_id uuid REFERENCES public.subscription_tiers(id),
  require_card boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_settings_singleton CHECK (id)
);

INSERT INTO public.platform_settings (id, trial_enabled, trial_days, trial_tier_id, require_card)
SELECT true, true, 14, (SELECT id FROM public.subscription_tiers ORDER BY sort_order DESC LIMIT 1), false
WHERE NOT EXISTS (SELECT 1 FROM public.platform_settings);

-- Real record of what communities have paid the platform for their plan.
CREATE TABLE IF NOT EXISTS public.plan_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  tier_id uuid NOT NULL REFERENCES public.subscription_tiers(id),
  amount numeric(12,2) NOT NULL,
  currency public.payment_currency NOT NULL,
  provider public.payment_provider NOT NULL,
  provider_ref text NOT NULL,
  status public.payment_status NOT NULL DEFAULT 'paid',
  paid_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_ref)
);
CREATE INDEX IF NOT EXISTS plan_payments_community_id_idx ON public.plan_payments(community_id, paid_at DESC);
