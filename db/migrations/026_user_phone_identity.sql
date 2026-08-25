-- Members without an email can now log in by phone. A user account is
-- identified by email OR phone (at least one), not necessarily both.
ALTER TABLE public.users ALTER COLUMN email DROP NOT NULL;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone text;

-- Phone is a login identity, so it must be unique (when present).
CREATE UNIQUE INDEX IF NOT EXISTS users_phone_unique ON public.users (phone) WHERE phone IS NOT NULL;

-- Every account must have at least one identity.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_identity_chk') THEN
    ALTER TABLE public.users ADD CONSTRAINT users_identity_chk CHECK (email IS NOT NULL OR phone IS NOT NULL);
  END IF;
END $$;
