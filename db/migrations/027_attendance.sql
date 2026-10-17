-- Weekly gathering sessions and member attendance. Safe to re-run.

INSERT INTO public.platform_modules (name, sort_order)
SELECT 'Attendance', COALESCE(MAX(sort_order), -1) + 1
FROM public.platform_modules
ON CONFLICT (name) DO NOTHING;

UPDATE public.subscription_tiers
SET modules = modules || '["Attendance"]'::jsonb,
    updated_at = now()
WHERE name IN ('Growth', 'Enterprise')
  AND NOT modules @> '["Attendance"]'::jsonb;

CREATE TABLE IF NOT EXISTS public.attendance_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  meeting_date date NOT NULL,
  title text NOT NULL DEFAULT 'Weekly gathering',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (community_id, meeting_date)
);
CREATE INDEX IF NOT EXISTS attendance_sessions_community_date_idx
  ON public.attendance_sessions(community_id, meeting_date DESC);

CREATE TABLE IF NOT EXISTS public.attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.attendance_sessions(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('present', 'absent', 'excused')),
  marked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, member_id)
);
CREATE INDEX IF NOT EXISTS attendance_records_session_id_idx
  ON public.attendance_records(session_id);