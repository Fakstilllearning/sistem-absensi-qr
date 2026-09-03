import { useEffect, useState } from "react";
import { supabase, type AttendanceSession } from "./supabase";

export function useActiveSession() {
  const [session, setSession] = useState<AttendanceSession | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("attendance_sessions")
      .select("*")
      .eq("status", "OPEN")
      .order("session_date", { ascending: false })
      .maybeSingle();
    setSession((data as AttendanceSession) ?? null);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  return { session, loading, refresh };
}
