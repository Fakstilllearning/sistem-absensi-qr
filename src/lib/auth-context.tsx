import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase, type Profile } from "./supabase";
import { getCurrentProfile, signOut as doSignOut } from "./auth";

type AuthContextValue = {
  ready: boolean;
  loading: boolean;
  profile: Profile | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);

  const refresh = async () => {
    const next = await getCurrentProfile();
    setProfile(next);
    setLoading(false);
  };

  useEffect(() => {
    let mounted = true;

    refresh();

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      (async () => {
        if (!session?.user) {
          setProfile(null);
          setLoading(false);
        } else {
          await refresh();
        }
      })();
    });

    setReady(true);
    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{ ready, loading, profile, refresh, signOut: doSignOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth harus digunakan di dalam AuthProvider");
  return ctx;
}
