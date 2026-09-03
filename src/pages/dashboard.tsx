import { useEffect, useState } from "react";
import {
  Activity,
  CalendarClock,
  CheckCircle2,
  HeartPulse,
  Moon,
  Users,
  XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useActiveSession } from "@/lib/use-active-session";
import { Badge, EmptyState, Spinner, statusTone } from "@/components/ui";
import type { AttendanceWithStudent } from "@/lib/supabase";

type Stats = {
  totalStudents: number;
  hadir: number;
  izin: number;
  sakit: number;
  alpa: number;
};

export function DashboardPage() {
  const { session, loading: sessionLoading } = useActiveSession();
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<AttendanceWithStudent[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!session) {
      setStats(null);
      setRecent([]);
      setLoading(false);
      return;
    }
    setLoading(true);

    const [{ count: total }, { count: hadir }, { count: izin }, { count: sakit }, { count: alpa }] =
      await Promise.all([
        supabase.from("students").select("*", { count: "exact", head: true }),
        supabase
          .from("attendance_records")
          .select("*", { count: "exact", head: true })
          .eq("session_id", session.id)
          .eq("status", "HADIR"),
        supabase
          .from("attendance_records")
          .select("*", { count: "exact", head: true })
          .eq("session_id", session.id)
          .eq("status", "IZIN"),
        supabase
          .from("attendance_records")
          .select("*", { count: "exact", head: true })
          .eq("session_id", session.id)
          .eq("status", "SAKIT"),
        supabase
          .from("attendance_records")
          .select("*", { count: "exact", head: true })
          .eq("session_id", session.id)
          .eq("status", "ALPA"),
      ]);

    setStats({
      totalStudents: total ?? 0,
      hadir: hadir ?? 0,
      izin: izin ?? 0,
      sakit: sakit ?? 0,
      alpa: alpa ?? 0,
    });

    const { data: recentData } = await supabase
      .from("attendance_records")
      .select("*, students(nim, name, class)")
      .eq("session_id", session.id)
      .order("scanned_at", { ascending: false, nullsFirst: false })
      .limit(8);

    setRecent((recentData as AttendanceWithStudent[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id]);

  const channel = supabase
    .channel("attendance-feed")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "attendance_records" },
      () => load()
    )
    .subscribe();

  useEffect(() => {
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id]);

  const belumAbsen = stats
    ? Math.max(stats.totalStudents - stats.hadir - stats.izin - stats.sakit - stats.alpa, 0)
    : 0;
  const percent = stats && stats.totalStudents > 0
    ? Math.round((stats.hadir / stats.totalStudents) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500">Ringkasan absensi kaderisasi terkini.</p>
        </div>
        {sessionLoading ? null : session ? (
          <div className="rounded-xl bg-emerald-50 px-4 py-2.5 ring-1 ring-emerald-200">
            <p className="text-xs font-medium text-emerald-700">Sesi aktif</p>
            <p className="text-sm font-bold text-emerald-900">{session.name}</p>
          </div>
        ) : (
          <div className="rounded-xl bg-amber-50 px-4 py-2.5 ring-1 ring-amber-200">
            <p className="text-xs font-medium text-amber-700">Belum ada sesi terbuka</p>
            <p className="text-sm font-bold text-amber-900">Admin harus membuka sesi</p>
          </div>
        )}
      </div>

      {!session && !sessionLoading ? (
        <EmptyState
          title="Belum ada sesi absensi yang dibuka"
          hint="Admin dapat membuka sesi pada menu Sesi agar scanner dapat digunakan."
        />
      ) : loading || !stats ? (
        <Spinner label="Memuat data absensi…" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <KpiCard icon={<Users className="w-5 h-5" />} label="Total Peserta" value={stats.totalStudents} tone="slate" />
            <KpiCard icon={<CheckCircle2 className="w-5 h-5" />} label="Hadir" value={stats.hadir} tone="emerald" />
            <KpiCard icon={<CalendarClock className="w-5 h-5" />} label="Izin" value={stats.izin} tone="blue" />
            <KpiCard icon={<HeartPulse className="w-5 h-5" />} label="Sakit" value={stats.sakit} tone="amber" />
            <KpiCard icon={<XCircle className="w-5 h-5" />} label="Alpa" value={stats.alpa} tone="red" />
            <KpiCard icon={<Moon className="w-5 h-5" />} label="Belum Absen" value={belumAbsen} tone="slate" />
          </div>

          <div className="rounded-2xl bg-emerald-600 p-5 text-white shadow-sm">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-emerald-100">
                  Persentase Hadir
                </p>
                <p className="text-3xl font-bold">{percent}%</p>
              </div>
              <div className="h-3 w-full max-w-xs overflow-hidden rounded-full bg-emerald-500/40">
                <div
                  className="h-full rounded-full bg-white transition-all"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          </div>

          <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
                <Activity className="w-4 h-4 text-emerald-600" />
                Scan Terbaru
              </h2>
              <Badge tone={session?.status === "OPEN" ? "success" : "neutral"}>
                {session?.status}
              </Badge>
            </div>
            {recent.length === 0 ? (
              <EmptyState title="Belum ada scan" hint="Scan QR mahasiswa untuk melihat aktivitas di sini." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {recent.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">
                        {r.students?.name ?? "Mahasiswa"}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {r.students?.nim ?? ""} · {r.students?.class ?? ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-400">
                        {r.scanned_at ? new Date(r.scanned_at).toLocaleTimeString("id-ID", {
                          hour: "2-digit",
                          minute: "2-digit",
                        }) : "—"}
                      </span>
                      <Badge tone={statusTone(r.status)}>{r.status}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "slate" | "emerald" | "blue" | "amber" | "red";
}) {
  const tones: Record<string, string> = {
    slate: "bg-slate-100 text-slate-700",
    emerald: "bg-emerald-100 text-emerald-700",
    blue: "bg-blue-100 text-blue-700",
    amber: "bg-amber-100 text-amber-700",
    red: "bg-red-100 text-red-700",
  };
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
      <div className={`mb-2 inline-flex rounded-lg p-2 ${tones[tone]}`}>{icon}</div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs font-medium text-slate-500">{label}</p>
    </div>
  );
}
