-- Community expenses: admin-entered outflows so the financial report can show
-- income and expenditure side by side (surplus/deficit). Manual entries, unlike
-- income which comes from recorded payments. Amounts in major units (₦/$), to
-- match dues_payments.amount.
CREATE TABLE IF NOT EXISTS public.community_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'NGN' CHECK (currency IN ('NGN', 'USD')),
  category text NOT NULL DEFAULT 'General',
  description text,
  spent_at date NOT NULL DEFAULT CURRENT_DATE,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS community_expenses_idx ON public.community_expenses(community_id, spent_at DESC);
