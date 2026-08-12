-- Password reset tokens for the "forgot password" flow. Same shape as
-- member_invites/sessions: the raw token only ever lives in the emailed link;
-- we store a SHA-256 hash, so a DB leak alone can't be used to reset anyone's
-- password. Single-use (used_at) and short-lived (expires_at).
CREATE TABLE IF NOT EXISTS public.password_resets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS password_resets_user_id_idx ON public.password_resets(user_id);
