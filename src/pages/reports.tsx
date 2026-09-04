import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { supabase, type AttendanceSession, type Student, type AttendanceRecord } from "@/lib/supabase";
import { useToasts } from "@/lib/use-toasts";
import { Button, EmptyState, Select, Spinner } from "@/components/ui";

export function ReportsPage() {
  const { success } = useToasts();
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionFilter, setSessionFilter] = useState("SEMUA");

  useEffect(() => {
    (async () => {
      const [{ data: s }, { data: st }, { data: r }] = await Promise.all([
        supabase.from("attendance_sessions").select("*").order("session_date", { ascending: false }),
        supabase.from("students").select("*").order("name", { ascending: true }),
        supabase.from("attendance_records").select("*"),
      ]);
      setSessions((s as AttendanceSession[]) ?? []);
      setStudents((st as Student[]) ?? []);
      setRecords((r as AttendanceRecord[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const filteredRecords = sessionFilter === "SEMUA"
    ? records
    : records.filter((r) => r.session_id === sessionFilter);

  const totals = {
    hadir: filteredRecords.filter((r) => r.status === "HADIR").length,
    izin: filteredRecords.filter((r) => r.status === "IZIN").length,
    sakit: filteredRecords.filter((r) => r.status === "SAKIT").length,
    alpa: filteredRecords.filter((r) => r.status === "ALPA").length,
  };

  const sessionName = (id: string) => sessions.find((s) => s.id === id)?.name ?? "—";

  const exportWeekly = () => {
    const header = ["No", "NIM", "Nama", "Jenis Kelamin", "Kelas", ...sessions.map((s) => s.name), "Total Hadir", "Total Alpa"];
    const rows = students.map((st, i) => {
      const perSession = sessions.map((s) => {
        const rec = records.find((r) => r.student_id === st.id && r.session_id === s.id);
        return rec?.status ?? "ALPA";
      });
      const hadir = perSession.filter((s) => s === "HADIR").length;
      const alpa = perSession.filter((s) => s === "ALPA").length;
      return [st.no_urut ?? i + 1, st.nim, st.name, st.gender ?? "-", st.class, ...perSession, hadir, alpa];
    });
    const csv = [header, ...rows]
      .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `weekly_report_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    success("Laporan mingguan diunduh.");
  };

  if (loading) return <Spinner label="Memuat laporan…" />;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Laporan</h1>
          <p className="text-sm text-slate-500">Rekap absensi dan laporan mingguan.</p>
        </div>
        <Button variant="secondary" onClick={exportWeekly}>
          <Download className="w-4 h-4" /> Export Weekly CSV
        </Button>
      </div>

      <Select label="Sesi" value={sessionFilter} onChange={(e) => setSessionFilter(e.target.value)} className="sm:w-72">
        <option value="SEMUA">Semua Sesi</option>
        {sessions.map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </Select>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard label="Hadir" value={totals.hadir} tone="emerald" />
        <SummaryCard label="Izin" value={totals.izin} tone="blue" />
        <SummaryCard label="Sakit" value={totals.sakit} tone="amber" />
        <SummaryCard label="Alpa" value={totals.alpa} tone="red" />
      </div>

      {students.length === 0 ? (
        <EmptyState title="Belum ada data mahasiswa" hint="Import data terlebih dahulu melalui menu Import Data." />
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-semibold text-slate-500">
                <th className="px-3 py-2">NIM</th>
                <th className="px-3 py-2">Nama</th>
                <th className="px-3 py-2">Jenis Kelamin</th>
                <th className="px-3 py-2">Kelas</th>
                {sessions.map((s) => (
                  <th key={s.id} className="px-3 py-2">{s.name}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {students.slice(0, 100).map((st) => (
                <tr key={st.id}>
                  <td className="px-3 py-2 text-slate-600">{st.nim}</td>
                  <td className="px-3 py-2 font-medium text-slate-800">{st.name}</td>
                  <td className="px-3 py-2 text-slate-600">{st.gender ?? "-"}</td>
                  <td className="px-3 py-2 text-slate-600">{st.class}</td>
                  {sessions.map((s) => {
                    const rec = records.find((r) => r.student_id === st.id && r.session_id === s.id);
                    return (
                      <td key={s.id} className="px-3 py-2 text-xs font-semibold text-slate-600">
                        {rec?.status ?? "ALPA"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {students.length > 100 ? (
            <p className="px-3 py-2 text-xs text-slate-400">Menampilkan 100 dari {students.length} mahasiswa. Export untuk data lengkap.</p>
          ) : null}
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: "emerald" | "blue" | "amber" | "red" }) {
  const tones: Record<string, string> = {
    emerald: "bg-emerald-100 text-emerald-700",
    blue: "bg-blue-100 text-blue-700",
    amber: "bg-amber-100 text-amber-700",
    red: "bg-red-100 text-red-700",
  };
  return (
    <div className={`rounded-xl p-4 text-center ${tones[tone]}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs font-medium">{label}</p>
    </div>
  );
}
