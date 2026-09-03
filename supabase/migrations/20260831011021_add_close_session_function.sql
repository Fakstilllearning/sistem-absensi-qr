/*
# Add close_session function for automatic ALPA assignment

1. New function
- public.close_session(p_session_id uuid, p_user_id uuid):
  - Closes the session (status -> CLOSED, sets end_time and closed_at).
  - Inserts ALPA attendance_records for all students who don't already have
    a record in that session.
  - Uses INSERT ... ON CONFLICT DO NOTHING to be safe against concurrent calls.
  - Logs the action to audit_logs.
  - Returns the number of ALPA records created.

2. Security
- SECURITY DEFINER so it can write attendance_records and audit_logs.
- Callable by authenticated role.
- Internally validates that the caller has ADMIN role before proceeding.
*/

CREATE OR REPLACE FUNCTION public.close_session(p_session_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_profile public.profiles;
  target_session public.attendance_sessions;
  alpa_count integer;
BEGIN
  SELECT * INTO current_profile
  FROM public.profiles
  WHERE auth_user_id = auth.uid() AND is_active = true;

  IF current_profile.id IS NULL OR current_profile.role <> 'ADMIN' THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  SELECT * INTO target_session FROM public.attendance_sessions WHERE id = p_session_id;
  IF target_session.id IS NULL THEN
    RAISE EXCEPTION 'SESSION_NOT_FOUND';
  END IF;
  IF target_session.status = 'CLOSED' THEN
    RAISE EXCEPTION 'SESSION_ALREADY_CLOSED';
  END IF;

  UPDATE public.attendance_sessions
  SET status = 'CLOSED', end_time = now(), closed_at = now()
  WHERE id = p_session_id;

  INSERT INTO public.attendance_records (student_id, session_id, status, scanned_at, scanned_by, notes)
  SELECT s.id, p_session_id, 'ALPA', NULL, current_profile.id, 'Auto: sesi ditutup'
  FROM public.students s
  WHERE NOT EXISTS (
    SELECT 1 FROM public.attendance_records ar
    WHERE ar.student_id = s.id AND ar.session_id = p_session_id
  )
  ON CONFLICT (student_id, session_id) DO NOTHING;

  GET DIAGNOSTICS alpa_count = ROW_COUNT;

  INSERT INTO public.audit_logs (user_id, action, target_type, target_id, metadata)
  VALUES (
    current_profile.id,
    'CLOSE_SESSION',
    'attendance_sessions',
    p_session_id,
    jsonb_build_object('alpa_created', alpa_count)
  );

  RETURN alpa_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.close_session(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.close_session(uuid) TO authenticated;
