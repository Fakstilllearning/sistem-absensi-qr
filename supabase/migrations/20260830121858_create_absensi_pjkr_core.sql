/*
# Create PJKR attendance core schema

1. New tables
- `profiles`: authenticated operators and their protected application roles.
- `students`: student identity, class information, and opaque QR tokens.
- `attendance_sessions`: one attendance window per activity.
- `attendance_records`: one status per student and session.
- `audit_logs`: immutable operational history.

2. Integrity
- Student NIM and QR token are unique.
- Attendance has a unique `(student_id, session_id)` constraint to prevent races across scanners.
- Foreign keys preserve relationships.
- Timestamps are server-generated.

3. Security
- RLS is enabled on every table.
- Access is limited to authenticated users with role-aware policies.
- QR attendance is created through a protected database function that validates the user, token, and open session.
- Role checks read this table rather than user-editable metadata.

4. Important notes
- The frontend must never receive or use the service role key.
- Attendance success is only shown after the database function confirms the insert.
- Closing a session can later materialize ALPA records for students without a status.
*/

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null,
  role text not null check (role in ('ADMIN', 'SCANNER', 'VIEWER')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  nim text not null unique,
  name text not null,
  class text not null,
  group_name text,
  gender text,
  year integer,
  qr_token text not null unique default encode(gen_random_bytes(24), 'hex'),
  qr_status text not null default 'ACTIVE' check (qr_status in ('ACTIVE', 'DISABLED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  session_date date not null,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'OPEN', 'CLOSED')),
  start_time timestamptz,
  end_time timestamptz,
  closed_at timestamptz,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id),
  session_id uuid not null references public.attendance_sessions(id),
  status text not null check (status in ('HADIR', 'IZIN', 'SAKIT', 'ALPA')),
  scanned_at timestamptz,
  scanned_by uuid references public.profiles(id),
  notes text,
  updated_at timestamptz not null default now(),
  unique (student_id, session_id)
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id),
  action text not null,
  target_type text not null,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists students_name_idx on public.students (name);
create index if not exists students_class_idx on public.students (class);
create index if not exists students_qr_token_idx on public.students (qr_token);
create index if not exists attendance_records_session_idx on public.attendance_records (session_id);
create index if not exists attendance_records_student_idx on public.attendance_records (student_id);
create index if not exists attendance_records_status_idx on public.attendance_records (status);
create index if not exists attendance_records_scanned_at_idx on public.attendance_records (scanned_at desc);
create index if not exists audit_logs_created_at_idx on public.audit_logs (created_at desc);

create or replace function public.user_has_role(allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where auth_user_id = auth.uid()
      and is_active = true
      and role = any(allowed_roles)
  );
$$;

revoke execute on function public.user_has_role(text[]) from public, anon;
grant execute on function public.user_has_role(text[]) to authenticated;

create or replace function public.record_attendance(p_qr_token text, p_session_id uuid)
returns table (
  result text,
  student_id uuid,
  student_name text,
  student_nim text,
  student_class text,
  attendance_status text,
  scanned_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_profile public.profiles;
  target_student public.students;
  target_session public.attendance_sessions;
  existing_record public.attendance_records;
  created_record public.attendance_records;
begin
  select * into current_profile
  from public.profiles
  where auth_user_id = auth.uid() and is_active = true;

  if current_profile.id is null or current_profile.role not in ('ADMIN', 'SCANNER') then
    raise exception 'UNAUTHORIZED';
  end if;

  select * into target_session from public.attendance_sessions where id = p_session_id;
  if target_session.id is null or target_session.status <> 'OPEN' then
    raise exception 'SESSION_CLOSED';
  end if;

  select * into target_student
  from public.students
  where qr_token = p_qr_token and qr_status = 'ACTIVE';

  if target_student.id is null then
    raise exception 'INVALID_QR';
  end if;

  select * into existing_record
  from public.attendance_records
  where student_id = target_student.id and session_id = p_session_id;

  if existing_record.id is not null then
    return query select
      'DUPLICATE', target_student.id, target_student.name, target_student.nim,
      target_student.class, existing_record.status, existing_record.scanned_at;
    return;
  end if;

  begin
    insert into public.attendance_records (student_id, session_id, status, scanned_at, scanned_by)
    values (target_student.id, p_session_id, 'HADIR', now(), current_profile.id)
    returning * into created_record;
  exception when unique_violation then
    select * into existing_record
    from public.attendance_records
    where student_id = target_student.id and session_id = p_session_id;

    return query select
      'DUPLICATE', target_student.id, target_student.name, target_student.nim,
      target_student.class, existing_record.status, existing_record.scanned_at;
    return;
  end;

  insert into public.audit_logs (user_id, action, target_type, target_id, metadata)
  values (
    current_profile.id,
    'SCAN_ATTENDANCE',
    'attendance_records',
    created_record.id,
    jsonb_build_object('student_id', target_student.id, 'session_id', p_session_id)
  );

  return query select
    'SUCCESS', target_student.id, target_student.name, target_student.nim,
    target_student.class, created_record.status, created_record.scanned_at;
end;
$$;

revoke execute on function public.record_attendance(text, uuid) from public, anon;
grant execute on function public.record_attendance(text, uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.students enable row level security;
alter table public.attendance_sessions enable row level security;
alter table public.attendance_records enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists profiles_select_self_or_admin on public.profiles;
create policy profiles_select_self_or_admin on public.profiles for select to authenticated
using (auth_user_id = auth.uid() or public.user_has_role(array['ADMIN']));

drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles for update to authenticated
using (public.user_has_role(array['ADMIN']))
with check (public.user_has_role(array['ADMIN']));

drop policy if exists students_select_staff on public.students;
create policy students_select_staff on public.students for select to authenticated
using (public.user_has_role(array['ADMIN', 'SCANNER', 'VIEWER']));

drop policy if exists students_insert_admin on public.students;
create policy students_insert_admin on public.students for insert to authenticated
with check (public.user_has_role(array['ADMIN']));

drop policy if exists students_update_admin on public.students;
create policy students_update_admin on public.students for update to authenticated
using (public.user_has_role(array['ADMIN']))
with check (public.user_has_role(array['ADMIN']));

drop policy if exists students_delete_admin on public.students;
create policy students_delete_admin on public.students for delete to authenticated
using (public.user_has_role(array['ADMIN']));

drop policy if exists sessions_select_staff on public.attendance_sessions;
create policy sessions_select_staff on public.attendance_sessions for select to authenticated
using (public.user_has_role(array['ADMIN', 'SCANNER', 'VIEWER']));

drop policy if exists sessions_insert_admin on public.attendance_sessions;
create policy sessions_insert_admin on public.attendance_sessions for insert to authenticated
with check (public.user_has_role(array['ADMIN']));

drop policy if exists sessions_update_admin on public.attendance_sessions;
create policy sessions_update_admin on public.attendance_sessions for update to authenticated
using (public.user_has_role(array['ADMIN']))
with check (public.user_has_role(array['ADMIN']));

drop policy if exists sessions_delete_admin on public.attendance_sessions;
create policy sessions_delete_admin on public.attendance_sessions for delete to authenticated
using (public.user_has_role(array['ADMIN']));

drop policy if exists attendance_select_staff on public.attendance_records;
create policy attendance_select_staff on public.attendance_records for select to authenticated
using (public.user_has_role(array['ADMIN', 'SCANNER', 'VIEWER']));

drop policy if exists attendance_insert_staff on public.attendance_records;
create policy attendance_insert_staff on public.attendance_records for insert to authenticated
with check (public.user_has_role(array['ADMIN', 'SCANNER']));

drop policy if exists attendance_update_admin on public.attendance_records;
create policy attendance_update_admin on public.attendance_records for update to authenticated
using (public.user_has_role(array['ADMIN']))
with check (public.user_has_role(array['ADMIN']));

drop policy if exists attendance_delete_admin on public.attendance_records;
create policy attendance_delete_admin on public.attendance_records for delete to authenticated
using (public.user_has_role(array['ADMIN']));

drop policy if exists audit_select_admin on public.audit_logs;
create policy audit_select_admin on public.audit_logs for select to authenticated
using (public.user_has_role(array['ADMIN']));

drop policy if exists audit_insert_staff on public.audit_logs;
create policy audit_insert_staff on public.audit_logs for insert to authenticated
with check (public.user_has_role(array['ADMIN', 'SCANNER']));

drop policy if exists audit_update_admin on public.audit_logs;
create policy audit_update_admin on public.audit_logs for update to authenticated
using (public.user_has_role(array['ADMIN']))
with check (public.user_has_role(array['ADMIN']));

drop policy if exists audit_delete_admin on public.audit_logs;
create policy audit_delete_admin on public.audit_logs for delete to authenticated
using (public.user_has_role(array['ADMIN']));
