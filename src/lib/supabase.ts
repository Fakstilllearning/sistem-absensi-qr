import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anonKey) {
  throw new Error(
    "Supabase belum dikonfigurasi. Pastikan VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY tersedia di .env"
  );
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const ROLES = ["ADMIN", "SCANNER", "VIEWER"] as const;
export type Role = (typeof ROLES)[number];
export type RoleWithPending = Role | "PENDING";

export type Profile = {
  id: string;
  auth_user_id: string;
  name: string;
  role: RoleWithPending;
  is_active: boolean;
};

export type Student = {
  id: string;
  nim: string;
  name: string;
  class: string;
  group_name: string | null;
  gender: string | null;
  year: number | null;
  no_urut: number | null;
  dosen_pembimbing: string | null;
  qr_token: string;
  qr_status: "ACTIVE" | "DISABLED";
};

export type AttendanceSession = {
  id: string;
  name: string;
  session_date: string;
  status: "DRAFT" | "OPEN" | "CLOSED";
  start_time: string | null;
  end_time: string | null;
  closed_at: string | null;
  created_by: string;
};

export type AttendanceRecord = {
  id: string;
  student_id: string;
  session_id: string;
  status: "HADIR" | "IZIN" | "SAKIT" | "ALPA";
  scanned_at: string | null;
  scanned_by: string | null;
  notes: string | null;
  updated_at: string;
};

export type AttendanceWithStudent = AttendanceRecord & {
  students: Pick<Student, "nim" | "name" | "class" | "dosen_pembimbing"> | null;
};

export type ScanResult = {
  result: "SUCCESS" | "DUPLICATE";
  student_id: string;
  student_name: string;
  student_nim: string;
  student_class: string;
  attendance_status: "HADIR" | "IZIN" | "SAKIT" | "ALPA";
  scanned_at: string | null;
};
