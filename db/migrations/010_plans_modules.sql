-- Real subscription plan config: member caps, module entitlements, and an
-- active/disabled flag (replacing the local-only prototype on the Plans &
-- Modules super-admin page). Safe to re-run.

ALTER TABLE public.subscription_tiers
  ADD COLUMN IF NOT EXISTS max_members int,               -- NULL = unlimited
  ADD COLUMN IF NOT EXISTS modules jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.platform_modules (
  name text PRIMARY KEY,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.platform_modules (name, sort_order) VALUES
  ('Membership', 0),
  ('Birthdays', 1),
  ('Broadcasts', 2),
  ('Call Tree', 3),
  ('Onboarding Form', 4),
  ('Dues', 5),
  ('Donations', 6),
  ('Elections', 7),
  ('Custom Roles', 8),
  ('Priority Support', 9)
ON CONFLICT (name) DO NOTHING;

-- Seed the same three tiers the super-admin Plans page has always shown
-- (previously hardcoded in the client, never backed by a real row) — only
-- if the table is still empty, so this never overwrites real configuration.
INSERT INTO public.subscription_tiers (name, platform_fee_pct, monthly_price_ngn, monthly_price_usd, sort_order, max_members, modules, active)
SELECT * FROM (VALUES
  ('Starter', 5.00::numeric, 23000::numeric, 29::numeric, 0, 100, '["Membership","Birthdays","Broadcasts"]'::jsonb, true),
  ('Growth', 5.00::numeric, 78000::numeric, 99::numeric, 1, 500, '["Membership","Birthdays","Broadcasts","Dues","Call Tree","Onboarding Form"]'::jsonb, true),
  ('Enterprise', 5.00::numeric, 235000::numeric, 299::numeric, 2, NULL, '["Membership","Birthdays","Broadcasts","Dues","Call Tree","Onboarding Form","Donations","Elections","Custom Roles","Priority Support"]'::jsonb, true)
) AS seed(name, platform_fee_pct, monthly_price_ngn, monthly_price_usd, sort_order, max_members, modules, active)
WHERE NOT EXISTS (SELECT 1 FROM public.subscription_tiers);
