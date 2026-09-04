import { useEffect, useMemo, useState } from "react";
import { Search, Download, Plus } from "lucide-react";
import { supabase, type AttendanceWithStudent, type AttendanceSession } from "@/lib/supabase";
import { hasRole } from "@/lib/auth";
import { useAuth } from "@/lib/auth-context";
import { useToasts } from "@/lib/use-toasts";
import { Badge, Button, EmptyState, Input, Modal, Select, Spinner, statusTone } from "@/components/ui";

const STATUSES = ["HADIR", "IZIN", "SAKIT", "ALPA"] as const;
type Status = (typeof STATUSES)[number];

export function AttendancePage() {
  const { profile } = useAuth();
  const { success, error } = useToasts();
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [records, setRecords] = useState<AttendanceWithStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSession, setFilterSession] = useState("SEMUA");
  const [filterStatus, setFilterStatus] = useState("SEMUA");
  const [q, setQ] = useState("");
  const [editTarget, setEditTarget] = useState<AttendanceWithStudent | null>(null);
  const [editStatus, setEditStatus] = useState<Status>("HADIR");
  const [editNote, setEditNote] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [manualNim, setManualNim] = useState("");
  const [manualSession, setManualSession] = useState("");
  const [manualStatus, setManualStatus] = useState<Status>("IZIN");
  const [manualNote, setManualNote] = useState("");

  const isAdmin = hasRole(profile, "ADMIN");

  useEffect(() => {
    supabase.from("attendance_sessions").select("*").order("session_date", { ascending: false })
      .then(({ data }) => setSessions((data as AttendanceSession[]) ?? []));
  }, []);

  const load = async () => {
    setLoading(true);
    let query = supabase
      .from("attendance_records")
      .select("*, students(nim, name, class, gender)")
      .order("scanned_at", { ascending: false, nullsFirst: false })
      .limit(200);
    if (filterSession !== "SEMUA") query = query.eq("session_id", filterSession);
    if (filterStatus !== "SEMUA") query = query.eq("status", filterStatus);
    const { data } = await query;
    setRecords((data as AttendanceWithStudent[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterSession, filterStatus]);

  const sessionName = (id: string) => sessions.find((s) => s.id === id)?.name ?? "—";

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return records;
    return records.filter(
      (r) =>
        r.students?.name?.toLowerCase().includes(term) ||
        r.students?.nim?.toLowerCase().includes(term)
    );
  }, [q, records]);

  const openEdit = (r: AttendanceWithStudent) => {
    setEditTarget(r);
    setEditStatus(r.status);
    setEditNote(r.notes ?? "");
  };

  const saveEdit = async () => {
    if (!editTarget || !profile) return;
    const { data: prof } = await supabase
      .from("profiles")
      .select("id")
      .eq("auth_user_id", profile.auth_user_id)
      .maybeSingle();

    const oldStatus = editTarget.status;
    const { error: err } = await supabase
      .from("attendance_records")
      .update({ status: editStatus, notes: editNote, updated_at: new Date().toISOString() })
      .eq("id", editTarget.id);

    if (err) {
      error("Gagal menyimpan perubahan.");
      return;
    }

    if (prof) {
      await supabase.from("audit_logs").insert({
        user_id: (prof as { id: string }).id,
        action: "EDIT_ATTENDANCE",
        target_type: "attendance_records",
        target_id: editTarget.id,
        metadata: { old: oldStatus, new: editStatus, note: editNote, session_id: editTarget.session_id },
      });
    }

    success("Perubahan absensi disimpan.");
    setEditTarget(null);
    await load();
  };

  const exportCsv = () => {
    const rows = [
      ["No", "NIM", "Nama", "Jenis Kelamin", "Kelas", "Sesi", "Status", "Waktu", "Catatan"],
      ...filtered.map((r, i) => [
        i + 1,
        r.students?.nim ?? "",
        r.students?.name ?? "",
        r.students?.gender ?? "",
        r.students?.class ?? "",
        sessionName(r.session_id),
        r.status,
        r.scanned_at ? new Date(r.scanned_at).toLocaleString("id-ID") : "",
        r.notes ?? "",
      ]),
    ];
    const csv = rows
      .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance_export_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    success("Laporan CSV diunduh.");
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Absensi</h1>
          <p className="text-sm text-slate-500">Daftar dan koreksi absensi mahasiswa.</p>
        </div>
        <div className="flex gap-2">
          {isAdmin ? (
            <Button onClick={() => setShowManual(true)}>
              <Plus className="w-4 h-4" /> Absensi Manual
            </Button>
          ) : null}
          <Button variant="secondary" onClick={exportCsv}>
            <Download className="w-4 h-4" /> Export CSV
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari nama atau NIM…"
            className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
          />
        </label>
        <Select value={filterSession} onChange={(e) => setFilterSession(e.target.value)}>
          <option value="SEMUA">Semua Sesi</option>
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </Select>
        <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="SEMUA">Semua Status</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </Select>
      </div>

      {loading ? (
        <Spinner label="Memuat absensi…" />
      ) : filtered.length === 0 ? (
        <EmptyState title="Tidak ada data absensi" hint="Ubah filter atau lakukan scan pada scanner." />
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-semibold text-slate-500">
                <th className="px-4 py-3">Nama</th>
                <th className="px-4 py-3">NIM</th>
                <th className="px-4 py-3">Kelas</th>
                <th className="px-4 py-3">Sesi</th>
                <th className="px-4 py-3">Waktu</th>
                <th className="px-4 py-3">Status</th>
                {isAdmin ? <th className="px-4 py-3 text-right">Aksi</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{r.students?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{r.students?.nim ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{r.students?.class ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{sessionName(r.session_id)}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {r.scanned_at ? new Date(r.scanned_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "—"}
                  </td>
                  <td className="px-4 py-3"><Badge tone={statusTone(r.status)}>{r.status}</Badge></td>
                  {isAdmin ? (
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>Edit</Button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={showManual} title="Absensi Manual" onClose={() => setShowManual(false)}>
        <div className="space-y-4">
          <Input
            label="NIM Mahasiswa"
            value={manualNim}
            onChange={(e) => setManualNim(e.target.value)}
            placeholder="260XXXXXX"
          />
          <Select
            label="Sesi"
            value={manualSession}
            onChange={(e) => setManualSession(e.target.value)}
          >
            <option value="">Pilih sesi…</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
          <Select
            label="Status"
            value={manualStatus}
            onChange={(e) => setManualStatus(e.target.value as Status)}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Catatan</span>
            <textarea
              value={manualNote}
              onChange={(e) => setManualNote(e.target.value)}
              rows={2}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              placeholder="Contoh: izin sakit, surat keterangan"
            />
          </label>
          <div className="flex gap-2">
            <Button
              onClick={async () => {
                if (!manualNim.trim() || !manualSession) {
                  error("Isi NIM dan pilih sesi.");
                  return;
                }
                const { data: student } = await supabase
                  .from("students")
                  .select("id")
                  .eq("nim", manualNim.trim())
                  .maybeSingle();
                if (!student) {
                  error("Mahasiswa tidak ditemukan.");
                  return;
                }
                const { data: prof } = await supabase
                  .from("profiles")
                  .select("id")
                  .eq("auth_user_id", profile!.auth_user_id)
                  .maybeSingle();
                const { error: err } = await supabase.from("attendance_records").upsert(
                  {
                    student_id: (student as { id: string }).id,
                    session_id: manualSession,
                    status: manualStatus,
                    notes: manualNote,
                    scanned_by: (prof as { id: string } | null)?.id ?? null,
                  },
                  { onConflict: "student_id,session_id" }
                );
                if (err) {
                  error("Gagal menyimpan absensi manual.");
                  return;
                }
                if (prof) {
                  await supabase.from("audit_logs").insert({
                    user_id: (prof as { id: string }).id,
                    action: "MANUAL_ATTENDANCE",
                    target_type: "attendance_records",
                    metadata: { nim: manualNim, session_id: manualSession, status: manualStatus, note: manualNote },
                  });
                }
                success("Absensi manual disimpan.");
                setShowManual(false);
                setManualNim("");
                setManualNote("");
                await load();
              }}
              className="flex-1"
            >Simpan</Button>
            <Button variant="secondary" onClick={() => setShowManual(false)}>Batal</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!editTarget} title="Koreksi Absensi" onClose={() => setEditTarget(null)}>
        {editTarget ? (
          <div className="space-y-4">
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-sm font-semibold text-slate-800">{editTarget.students?.name}</p>
              <p className="text-xs text-slate-500">{editTarget.students?.nim} · {editTarget.students?.class}</p>
              <p className="mt-1 text-xs text-slate-500">Status saat ini: <Badge tone={statusTone(editTarget.status)}>{editTarget.status}</Badge></p>
            </div>
            <Select label="Status baru" value={editStatus} onChange={(e) => setEditStatus(e.target.value as Status)}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </Select>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Catatan / Alasan</span>
              <textarea
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                placeholder="Contoh: izin kegiatan organisasi"
              />
            </label>
            <div className="flex gap-2">
              <Button onClick={saveEdit} className="flex-1">Simpan</Button>
              <Button variant="secondary" onClick={() => setEditTarget(null)}>Batal</Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
