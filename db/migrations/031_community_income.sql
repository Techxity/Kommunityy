-- Community income: admin-entered inflows for money members sent straight to
-- the community's bank account (or paid in cash) instead of through a Paystack
-- payment link. Mirrors community_expenses. Counted in the financial report's
-- income and surplus/deficit, but never in the funds position: that figure is
-- money held on the platform, and these funds never passed through it.
-- Amounts in major units (₦/$), to match dues_payments.amount. Safe to re-run.
CREATE TABLE IF NOT EXISTS public.community_income (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'NGN' CHECK (currency IN ('NGN', 'USD')),
  category text NOT NULL DEFAULT 'Other',
  payer_name text,
  description text,
  received_at date NOT NULL DEFAULT CURRENT_DATE,
  receipt_base64 text,
  receipt_mime text,
  receipt_name text,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS community_income_idx ON public.community_income(community_id, received_at DESC);
