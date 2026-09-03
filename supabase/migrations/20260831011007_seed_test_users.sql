/*
# Create seed admin, scanner, and viewer test accounts

1. New auth users
- admin@kaderisasi.upi.edu (ADMIN)
- scanner@kaderisasi.upi.edu (SCANNER)
- viewer@kaderisasi.upi.edu (VIEWER)

2. New profiles
- One profile row per auth user with the correct role.

3. Security
- Passwords are hashed by auth.users crypt mechanism.
- These are test credentials for panitia to validate the app before real use.
- Email confirmation is bypassed (email_confirmed_at set to now()).
*/

-- Admin
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, confirmation_token, recovery_token
)
SELECT
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(), 'authenticated', 'authenticated', 'admin@kaderisasi.upi.edu',
  crypt('admin12345', gen_salt('bf')), now(), now(), now(), '', ''
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@kaderisasi.upi.edu');

-- Scanner
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, confirmation_token, recovery_token
)
SELECT
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(), 'authenticated', 'authenticated', 'scanner@kaderisasi.upi.edu',
  crypt('scanner12345', gen_salt('bf')), now(), now(), now(), '', ''
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'scanner@kaderisasi.upi.edu');

-- Viewer
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, confirmation_token, recovery_token
)
SELECT
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(), 'authenticated', 'authenticated', 'viewer@kaderisasi.upi.edu',
  crypt('viewer12345', gen_salt('bf')), now(), now(), now(), '', ''
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'viewer@kaderisasi.upi.edu');

-- Profiles
INSERT INTO public.profiles (auth_user_id, name, role)
SELECT id, 'Admin Sekretaris', 'ADMIN'
FROM auth.users WHERE email = 'admin@kaderisasi.upi.edu'
ON CONFLICT (auth_user_id) DO NOTHING;

INSERT INTO public.profiles (auth_user_id, name, role)
SELECT id, 'Panitia Scanner', 'SCANNER'
FROM auth.users WHERE email = 'scanner@kaderisasi.upi.edu'
ON CONFLICT (auth_user_id) DO NOTHING;

INSERT INTO public.profiles (auth_user_id, name, role)
SELECT id, 'Ketua Bidang', 'VIEWER'
FROM auth.users WHERE email = 'viewer@kaderisasi.upi.edu'
ON CONFLICT (auth_user_id) DO NOTHING;
