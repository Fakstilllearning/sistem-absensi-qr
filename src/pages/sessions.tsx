import { useEffect, useState } from "react";
import { Plus, Lock, Unlock, CalendarDays, Trash2 } from "lucide-react";
import { supabase, type AttendanceSession } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useToasts } from "@/lib/use-toasts";
import { Badge, Button, EmptyState, Input, Modal, Spinner } from "@/components/ui";

export function SessionsPage() {
  const { profile } = useAuth();
  const { success, error } = useToasts();
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [closeTarget, setCloseTarget] = useState<AttendanceSession | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AttendanceSession | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({ name: "", date: new Date().toISOString().slice(0, 10) });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("attendance_sessions")
      .select("*")
      .order("session_date", { ascending: false });
    setSessions((data as AttendanceSession[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    if (!profile) return;
    const { data: prof } = await supabase
      .from("profiles")
      .select("id")
      .eq("auth_user_id", profile.auth_user_id)
      .maybeSingle();
    if (!prof) {
      error("Profil admin tidak ditemukan.");
      return;
    }
    const { error: err } = await supabase.from("attendance_sessions").insert({
      name: form.name.trim(),
      session_date: form.date,
      status: "DRAFT",
      created_by: prof.id,
    });
    if (err) error("Gagal membuat sesi.");
    else {
      success("Sesi dibuat.");
      setShowCreate(false);
      setForm({ name: "", date: new Date().toISOString().slice(0, 10) });
      await load();
    }
  };

  const open = async (s: AttendanceSession) => {
    const { error: err } = await supabase
      .from("attendance_sessions")
      .update({ status: "OPEN", start_time: new Date().toISOString(), end_time: null, closed_at: null })
      .eq("id", s.id);
    if (err) error("Gagal membuka sesi.");
    else {
      success("Sesi dibuka. Scanner siap digunakan.");
      await load();
    }
  };

  const close = async (s: AttendanceSession) => {
    const { data, error: err } = await supabase.rpc("close_session", {
      p_session_id: s.id,
    });
    if (err) error("Gagal menutup sesi.");
    else {
      const alpa = typeof data === "number" ? data : 0;
      success(`Sesi ditutup. ${alpa} mahasiswa tanpa status menjadi ALPA.`);
      setCloseTarget(null);
      await load();
    }
  };

  const deleteSession = async (s: AttendanceSession) => {
    setDeleting(true);
    const { error: err } = await supabase.from("attendance_sessions").delete().eq("id", s.id);
    setDeleting(false);
    if (err) {
      error("Gagal menghapus sesi.");
      return;
    }
    success(`Sesi "${s.name}" berhasil dihapus.`);
    setDeleteTarget(null);
    await load();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Sesi Absensi</h1>
          <p className="text-sm text-slate-500">Kelola sesi kegiatan kaderisasi.</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4" /> Sesi Baru
        </Button>
      </div>

      {loading ? (
        <Spinner label="Memuat sesi…" />
      ) : sessions.length === 0 ? (
        <EmptyState title="Belum ada sesi" hint="Buat sesi pertama untuk kegiatan kaderisasi." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {sessions.map((s) => (
            <div key={s.id} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-base font-bold text-slate-900">{s.name}</p>
                  <p className="flex items-center gap-1.5 text-sm text-slate-500">
                    <CalendarDays className="w-4 h-4" />
                    {new Date(s.session_date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                  </p>
                </div>
                <Badge
                  tone={s.status === "OPEN" ? "success" : s.status === "CLOSED" ? "danger" : "neutral"}
                >
                  {s.status}
                </Badge>
              </div>
              <div className="mt-4 flex gap-2">
                {s.status === "DRAFT" || s.status === "CLOSED" ? (
                  <Button size="sm" onClick={() => open(s)}>
                    <Unlock className="w-4 h-4" /> Buka Sesi
                  </Button>
                ) : null}
                {s.status === "OPEN" ? (
                  <Button size="sm" variant="danger" onClick={() => setCloseTarget(s)}>
                    <Lock className="w-4 h-4" /> Tutup Sesi
                  </Button>
                ) : null}
                <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(s)} className="text-red-600 hover:bg-red-50">
                  <Trash2 className="w-4 h-4" /> Hapus
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showCreate} title="Buat Sesi Baru" onClose={() => setShowCreate(false)}>
        <div className="space-y-4">
          <Input
            label="Nama sesi"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Kaderisasi Hari 1"
          />
          <Input
            label="Tanggal"
            type="date"
            value={form.date}
            onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
          />
          <div className="flex gap-2">
            <Button onClick={create} className="flex-1">Buat</Button>
            <Button variant="secondary" onClick={() => setShowCreate(false)}>Batal</Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!closeTarget}
        title="Tutup Sesi Absensi"
        onClose={() => setCloseTarget(null)}
      >
        {closeTarget ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-700">
              Mahasiswa yang belum memiliki catatan akan dianggap <b>ALPA</b> jika tidak memiliki status izin/sakit.
              Apakah Anda yakin ingin menutup sesi <b>{closeTarget.name}</b>?
            </p>
            <div className="flex gap-2">
              <Button variant="danger" onClick={() => close(closeTarget)} className="flex-1">
                Ya, Tutup Sesi
              </Button>
              <Button variant="secondary" onClick={() => setCloseTarget(null)}>Batal</Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={!!deleteTarget}
        title="Hapus Sesi"
        onClose={() => setDeleteTarget(null)}
      >
        {deleteTarget ? (
          <div className="space-y-4">
            <div className="rounded-xl bg-red-50 p-4 ring-1 ring-red-200">
              <p className="text-sm text-red-700">
                Sesi <b>{deleteTarget.name}</b> dan semua data absensi terkait akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => deleteSession(deleteTarget)} loading={deleting} className="flex-1 bg-red-600 hover:bg-red-700">
                Ya, Hapus Sesi
              </Button>
              <Button variant="secondary" onClick={() => setDeleteTarget(null)} className="flex-1">Batal</Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
