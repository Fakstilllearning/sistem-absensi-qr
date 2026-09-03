/*
# Auto-create profile for new auth users (Google OAuth support)

1. New function
- public.handle_new_user(): trigger function that fires on auth.users INSERT.
  - Creates a profiles row with the new user's ID.
  - Sets name from user_metadata (Google provides full_name or name).
  - Defaults role to 'VIEWER' — admin can upgrade later.
  - Uses ON CONFLICT to be idempotent (safe if profile already exists).

2. New trigger
- on_auth_user_created: AFTER INSERT on auth.users.

3. Security
- The function runs as SECURITY DEFINER with search_path set.
- It only inserts into public.profiles, nothing else.
- Revoked from anon/public, granted to authenticated (trigger runs as owner).
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
  VALUES (NEW.id, v_name, 'VIEWER', true)
  ON CONFLICT (auth_user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM public, anon;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
