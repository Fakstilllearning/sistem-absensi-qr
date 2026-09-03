/*
# Update student fields, add PENDING role, role self-selection, seed test sessions

1. Schema changes
- students: add no_urut (int), dosen_pembimbing (text), remove group_name/gender/year constraints (kept for compat).
  Actually: add no_urut SERIAL-like and dosen_pembimbing column. group_name, gender, year remain nullable.
- profiles: allow 'PENDING' role for Google users who haven't chosen yet.

2. New function: set_own_role(p_role text)
- Lets an authenticated user with role='PENDING' set their own role to ADMIN/SCANNER/VIEWER.
- Once set, cannot be changed again (no longer PENDING).
- SECURITY DEFINER, checks auth.uid(), validates role.

3. Seed 2 test sessions (Kaderisasi Hari 1 & 2) as DRAFT.

4. Security
- set_own_role is SECURITY DEFINER, only callable by authenticated.
- Profiles UPDATE is restricted to ADMIN by RLS, so users can't change role directly.
  set_own_role bypasses RLS as SECURITY DEFINER to update only their own PENDING row.
*/

-- Add new columns to students
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS no_urut integer;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS dosen_pembimbing text;

-- Allow PENDING role in profiles check constraint
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('ADMIN', 'SCANNER', 'VIEWER', 'PENDING'));

-- set_own_role function
CREATE OR REPLACE FUNCTION public.set_own_role(p_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles;
BEGIN
  SELECT * INTO v_profile FROM public.profiles WHERE auth_user_id = auth.uid();

  IF v_profile.id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  IF v_profile.role <> 'PENDING' THEN
    RAISE EXCEPTION 'ROLE_ALREADY_SET';
  END IF;

  IF p_role NOT IN ('ADMIN', 'SCANNER', 'VIEWER') THEN
    RAISE EXCEPTION 'INVALID_ROLE';
  END IF;

  UPDATE public.profiles SET role = p_role, updated_at = now() WHERE id = v_profile.id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_own_role(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_own_role(text) TO authenticated;

-- Seed 2 test sessions (only if no sessions exist)
INSERT INTO public.attendance_sessions (name, session_date, status, created_by)
SELECT 'Kaderisasi Hari 1', '2026-09-10', 'DRAFT', p.id
FROM public.profiles p
WHERE p.role = 'ADMIN'
AND NOT EXISTS (SELECT 1 FROM public.attendance_sessions)
LIMIT 1;

INSERT INTO public.attendance_sessions (name, session_date, status, created_by)
SELECT 'Kaderisasi Hari 2', '2026-09-11', 'DRAFT', p.id
FROM public.profiles p
WHERE p.role = 'ADMIN'
AND NOT EXISTS (SELECT 1 FROM public.attendance_sessions WHERE name = 'Kaderisasi Hari 2')
LIMIT 1;

-- Grant UPDATE on profiles only for the set_own_role path (RLS still blocks direct UPDATE)
-- No grant change needed: RLS blocks direct update, set_own_role bypasses as SECURITY DEFINER
