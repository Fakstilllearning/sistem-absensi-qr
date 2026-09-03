/*
# Update auto-profile trigger to default new Google users to PENDING role

1. Changes
- handle_new_user() now inserts role='PENDING' instead of 'VIEWER'.
  This ensures Google OAuth users land on the role selection page after first login.
- Idempotent via ON CONFLICT DO NOTHING.

2. Security
- SECURITY DEFINER, search_path set, revoked from anon/public.
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
BEGIN
  v_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1),
    'Pengguna Baru'
  );

  INSERT INTO public.profiles (auth_user_id, name, role, is_active)
  VALUES (NEW.id, v_name, 'PENDING', true)
  ON CONFLICT (auth_user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM public, anon;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
