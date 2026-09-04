import { useEffect, useMemo, useState } from "react";
import { Search, QrCode, RefreshCw, Ban, Printer } from "lucide-react";
import QRCode from "qrcode";
import { supabase, type Student } from "@/lib/supabase";
import { hasRole } from "@/lib/auth";
import { useAuth } from "@/lib/auth-context";
import { useToasts } from "@/lib/use-toasts";
import { Badge, Button, EmptyState, Input, Modal, Select, Spinner } from "@/components/ui";
import { LogoHmp, LogoUpiFpok } from "@/components/brand";

export function StudentsPage() {
  const { profile } = useAuth();
  const { toasts, success, error } = useToasts();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [kelas, setKelas] = useState("SEMUA");
  const [selected, setSelected] = useState<Student | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrBusy, setQrBusy] = useState(false);

  const isAdmin = hasRole(profile, "ADMIN");

  const load = async () => {
    setLoading(true);
    let query = supabase.from("students").select("*").order("name", { ascending: true });
    if (kelas !== "SEMUA") query = query.eq("class", kelas);
    const { data } = await query;
    setStudents((data as Student[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kelas]);

  const classes = useMemo(() => {
    const set = new Set<string>();
    students.forEach((s) => set.add(s.class));
    return Array.from(set).sort();
  }, [students]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return students;
    return students.filter(
      (s) => s.name.toLowerCase().includes(term) || s.nim.toLowerCase().includes(term)
    );
  }, [q, students]);

  const regenerate = async (s: Student) => {
    setQrBusy(true);
    const { error: err } = await supabase
      .from("students")
      .update({ qr_token: crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 8) })
      .eq("id", s.id);
    setQrBusy(false);
    if (err) error("Gagal membuat ulang QR.");
    else {
      success("QR berhasil dibuat ulang.");
      await load();
    }
  };

  const toggleQr = async (s: Student) => {
    const next = s.qr_status === "ACTIVE" ? "DISABLED" : "ACTIVE";
    const { error: err } = await supabase.from("students").update({ qr_status: next }).eq("id", s.id);
    if (err) error("Gagal mengubah status QR.");
    else {
      success(next === "ACTIVE" ? "QR diaktifkan." : "QR dinonaktifkan.");
      await load();
    }
  };

  const openQr = async (s: Student) => {
    setSelected(s);
    setQrDataUrl(null);
    try {
      const url = await QRCode.toDataURL(s.qr_token, { width: 320, margin: 2, color: { dark: "#0f172a", light: "#ffffff" } });
      setQrDataUrl(url);
    } catch {
      error("Gagal membuat QR.");
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Mahasiswa</h1>
        <p className="text-sm text-slate-500">Daftar peserta kaderisasi dan QR Code.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
        <Input
          placeholder="Cari nama atau NIM…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Select value={kelas} onChange={(e) => setKelas(e.target.value)}>
          <option value="SEMUA">Semua Kelas</option>
          {classes.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </Select>
      </div>

      {loading ? (
        <Spinner label="Memuat mahasiswa…" />
      ) : filtered.length === 0 ? (
        <EmptyState title="Tidak ada mahasiswa" hint="Coba ubah pencarian atau filter kelas." />
      ) : (
        <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
          <div className="hidden grid-cols-[60px_1fr_1fr_1fr_100px_120px_140px] gap-4 border-b border-slate-100 px-4 py-3 text-xs font-semibold text-slate-500 sm:grid">
            <span>No</span>
            <span>Nama</span>
            <span>NIM</span>
            <span>Jenis Kelamin</span>
            <span>Kelas</span>
            <span>QR</span>
            <span className="text-right">Aksi</span>
          </div>
          <ul className="divide-y divide-slate-100">
            {filtered.map((s) => (
              <li
                key={s.id}
                className="grid grid-cols-1 gap-2 px-4 py-3 sm:grid-cols-[60px_1fr_1fr_1fr_100px_120px_140px] sm:items-center sm:gap-4"
              >
                <p className="hidden text-sm text-slate-600 sm:block">{s.no_urut ?? "-"}</p>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">{s.name}</p>
                  <p className="truncate text-xs text-slate-500 sm:hidden">{s.no_urut ?? "-"} · {s.nim} · {s.class}</p>
                </div>
                <p className="hidden text-sm text-slate-600 sm:block">{s.nim}</p>
                <p className="hidden truncate text-sm text-slate-600 sm:block">{s.gender ?? "-"}</p>
                <p className="hidden text-sm text-slate-600 sm:block">{s.class}</p>
                <div className="hidden sm:block">
                  <Badge tone={s.qr_status === "ACTIVE" ? "success" : "danger"}>
                    {s.qr_status === "ACTIVE" ? "AKTIF" : "NONAKTIF"}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  <Button size="sm" variant="secondary" onClick={() => openQr(s)}>
                    <QrCode className="w-4 h-4" /> QR
                  </Button>
                  {isAdmin ? (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => regenerate(s)} loading={qrBusy}>
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => toggleQr(s)}>
                        <Ban className="w-4 h-4" />
                      </Button>
                    </>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Modal open={!!selected} title="QR Code Mahasiswa" onClose={() => setSelected(null)}>
        {selected ? (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-3 rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-2">
                <LogoHmp className="h-8 w-8" />
                <LogoUpiFpok className="h-8 w-auto" />
              </div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                Kaderisasi PJKR UPI 2026
              </p>
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="QR" className="h-48 w-48" />
              ) : (
                <Spinner label="Membuat QR…" />
              )}
              <div className="w-full space-y-1 text-center">
                <p className="text-sm font-bold text-slate-900">{selected.name}</p>
                <p className="text-sm text-slate-600">NIM: {selected.nim}</p>
                <p className="text-sm text-slate-600">Jenis Kelamin: {selected.gender ?? "-"}</p>
                <p className="text-sm text-slate-600">Kelas: {selected.class}</p>
              </div>
            </div>
            <div className="flex gap-2">
              {qrDataUrl ? (
                <a
                  href={qrDataUrl}
                  download={`qr_${selected.nim}.png`}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  <Printer className="w-4 h-4" /> Download QR
                </a>
              ) : null}
              <Button variant="secondary" onClick={() => setSelected(null)} className="flex-1">
                Tutup
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      {toasts.length > 0 ? (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2">
          {toasts.map((t) => (
            <div key={t.id} className="rounded-xl bg-white px-4 py-3 text-sm shadow-lg ring-1 ring-slate-200">
              {t.message}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
