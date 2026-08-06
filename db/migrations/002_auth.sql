-- Adds real authentication to the Neon database (replaces Supabase Auth).
-- Run this once against your existing database (the one db/schema.sql was
-- already applied to) in the Neon SQL Editor.
--
-- Adds: users, sessions, login_attempts.
-- Alters: user_roles.user_id and payouts.requested_by/approved_by now
--   reference real accounts in `users`.

CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON public.sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON public.sessions(expires_at);

-- Rate limiting for login attempts (per email or per IP — see auth.functions.ts).
CREATE TABLE IF NOT EXISTS public.login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS login_attempts_identifier_idx ON public.login_attempts(identifier, attempted_at);

-- user_roles.user_id previously referenced a Supabase auth user id with no
-- local FK. Now that accounts live in this database, tie it down for real.
DO $$ BEGIN
  ALTER TABLE public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.payouts
    ADD CONSTRAINT payouts_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.users(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.payouts
    ADD CONSTRAINT payouts_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
