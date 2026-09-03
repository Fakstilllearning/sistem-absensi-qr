import { supabase, type Profile, type Role } from "./supabase";

export type Session = {
  user: {
    id: string;
    email: string;
  };
  profile: Profile;
};

export async function getCurrentProfile(): Promise<Profile | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  return (data as Profile) ?? null;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.origin,
    },
  });
  if (error) throw error;
}

export async function setOwnRole(role: Role) {
  const { error } = await supabase.rpc("set_own_role", { p_role: role });
  if (error) throw error;
}

export async function signOut() {
  await supabase.auth.signOut();
}

export function hasRole(profile: Profile | null, ...roles: Role[]) {
  if (!profile || !profile.is_active) return false;
  return roles.includes(profile.role as Role);
}

export function isPending(profile: Profile | null) {
  return !!profile && profile.role === "PENDING";
}

export const AUTH_ERRORS: Record<string, string> = {
  "Invalid login credentials": "Email atau password salah.",
  "Email not confirmed": "Email belum dikonfirmasi. Hubungi admin.",
  "User already registered": "Email sudah terdaftar.",
};

export function friendlyAuthError(message: string) {
  return AUTH_ERRORS[message] ?? "Gagal masuk. Periksa email dan password Anda.";
}
