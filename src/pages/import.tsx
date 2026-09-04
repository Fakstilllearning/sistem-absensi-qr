import { useRef, useState } from "react";
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { hasRole } from "@/lib/auth";
import { useAuth } from "@/lib/auth-context";
import { useToasts } from "@/lib/use-toasts";
import { Badge, Button, EmptyState, Modal, Select, Spinner } from "@/components/ui";

type ParsedRow = {
  rowNumber: number;
  no_urut: string;
  nim: string;
  name: string;
  class: string;
  group_name: string;
  gender: string;
  year: string;
  errors: string[];
};

export function ImportPage() {
  const { profile } = useAuth();
  const { success, error, warning } = useToasts();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [mode, setMode] = useState<"INSERT" | "UPSERT" | "SKIP">("UPSERT");
  const [summary, setSummary] = useState<{ inserted: number; updated: number; skipped: number; invalid: number } | null>(null);
  const [showClear, setShowClear] = useState(false);
  const [clearing, setClearing] = useState(false);

  const isAdmin = hasRole(profile, "ADMIN");

  const parseCsv = (text: string): ParsedRow[] => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length === 0) return [];
    const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const idx = (name: string) => header.indexOf(name);
    const iNoUrut = idx("no_urut") >= 0 ? idx("no_urut") : idx("no");
    const iNim = idx("nim");
    const iName = idx("name") >= 0 ? idx("name") : idx("nama");
    const iClass = idx("class") >= 0 ? idx("class") : idx("kelas");
    const iGroup = idx("group") >= 0 ? idx("group") : idx("kelompok");
    const iGender = idx("gender") >= 0 ? idx("gender") : idx("jenis_kelamin");
    const iYear = idx("year") >= 0 ? idx("year") : idx("tahun");

    const seen = new Set<string>();
    const out: ParsedRow[] = [];

    for (let r = 1; r < lines.length; r++) {
      const cols = lines[r].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
      const noUrut = iNoUrut >= 0 ? cols[iNoUrut] : "";
      const nim = iNim >= 0 ? cols[iNim] : "";
      const name = iName >= 0 ? cols[iName] : "";
      const gender = iGender >= 0 ? cols[iGender] : "";
      const klass = iClass >= 0 ? cols[iClass] : "";
      const errs: string[] = [];
      if (!noUrut) errs.push("No urut kosong");
      if (!nim) errs.push("NIM kosong");
      if (!name) errs.push("Nama kosong");
      if (!gender) errs.push("Jenis kelamin kosong");
      if (!klass) errs.push("Kelas kosong");
      if (nim && seen.has(nim)) errs.push("Duplikat dalam file");
      if (nim) seen.add(nim);

      out.push({
        rowNumber: r,
        no_urut: noUrut,
        nim,
        name,
        class: klass,
        group_name: iGroup >= 0 ? cols[iGroup] : "",
        gender,
        year: iYear >= 0 ? cols[iYear] : "",
        errors: errs,
      });
    }
    return out;
  };

  const onFile = async (file: File) => {
    setParsing(true);
    setSummary(null);
    setFileName(file.name);
    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      setRows(parsed);
      if (parsed.length === 0) warning("File kosong atau format salah.");
    } catch {
      error("Gagal membaca file.");
    } finally {
      setParsing(false);
    }
  };

  const valid = rows.filter((r) => r.errors.length === 0);
  const invalid = rows.filter((r) => r.errors.length > 0);

  const doImport = async () => {
    if (!profile) return;
    setImporting(true);
    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;

    for (const r of valid) {
      const payload = {
        no_urut: r.no_urut ? parseInt(r.no_urut, 10) : null,
        nim: r.nim,
        name: r.name,
        class: r.class,
        group_name: r.group_name || null,
        gender: r.gender || null,
        year: r.year ? parseInt(r.year, 10) : null,
      };

      if (mode === "INSERT") {
        const { error: err } = await supabase.from("students").insert(payload);
        if (err) {
          if (err.message.includes("duplicate")) skipped++;
          else failed++;
        } else inserted++;
      } else if (mode === "UPSERT") {
        const { error: err } = await supabase
          .from("students")
          .upsert(payload, { onConflict: "nim", ignoreDuplicates: false });
        if (err) failed++;
        else updated++;
      } else {
        const { data: existing } = await supabase.from("students").select("id").eq("nim", r.nim).maybeSingle();
        if (existing) {
          skipped++;
        } else {
          const { error: err } = await supabase.from("students").insert(payload);
          if (err) failed++;
          else inserted++;
        }
      }
    }

    setSummary({ inserted, updated: mode === "UPSERT" ? updated : 0, skipped, invalid: failed + invalid.length });
    setImporting(false);
    success(`Import selesai: ${inserted} ditambah, ${mode === "UPSERT" ? updated : 0} diperbarui, ${skipped} dilewati.`);

    const { data: prof } = await supabase
      .from("profiles")
      .select("id")
      .eq("auth_user_id", profile.auth_user_id)
      .maybeSingle();
    if (prof) {
      await supabase.from("audit_logs").insert({
        user_id: (prof as { id: string }).id,
        action: "IMPORT_STUDENT",
        target_type: "students",
        metadata: { file: fileName, inserted, updated, skipped, failed },
      });
    }
  };

  const clearAllStudents = async () => {
    setClearing(true);
    const { data: deleted, error: err } = await supabase.from("students").delete().neq("id", "00000000-0000-0000-0000-000000000000").select("id");
    setClearing(false);
    setShowClear(false);
    if (err) {
      error("Gagal menghapus data mahasiswa.");
      return;
    }
    const count = deleted?.length ?? 0;
    success(`${count} data mahasiswa berhasil dihapus.`);
    setRows([]);
    setSummary(null);
    setFileName("");
    if (profile) {
      const { data: prof } = await supabase.from("profiles").select("id").eq("auth_user_id", profile.auth_user_id).maybeSingle();
      if (prof) {
        await supabase.from("audit_logs").insert({
          user_id: (prof as { id: string }).id,
          action: "CLEAR_ALL_STUDENTS",
          target_type: "students",
          metadata: { deleted_count: count },
        });
      }
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Import Data Mahasiswa</h1>
          <p className="text-sm text-slate-500">Unggah file CSV dari Excel untuk menambah peserta kaderisasi.</p>
        </div>
        {isAdmin ? (
          <Button variant="ghost" onClick={() => setShowClear(true)} className="text-red-600 hover:bg-red-50">
            <Trash2 className="w-4 h-4" /> Hapus Semua Data
          </Button>
        ) : null}
      </div>

      <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-8 text-center">
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
          }}
        />
        <FileSpreadsheet className="mx-auto mb-3 h-10 w-10 text-emerald-600" />
        <p className="text-sm font-medium text-slate-700">
          {fileName ? `File: ${fileName}` : "Pilih file CSV"}
        </p>
        <p className="mb-4 mt-1 text-xs text-slate-500">
          Kolom wajib: no_urut, nim, nama, jenis_kelamin, kelas. Kolom opsional: group, year.
        </p>
        <Button onClick={() => fileRef.current?.click()} loading={parsing}>
          <Upload className="w-4 h-4" /> Pilih File CSV
        </Button>
      </div>

      {parsing ? <Spinner label="Memproses file…" /> : null}

      {rows.length > 0 && !summary ? (
        <>
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Total Baris" value={rows.length} tone="slate" />
            <StatCard label="Valid" value={valid.length} tone="emerald" />
            <StatCard label="Bermasalah" value={invalid.length} tone="red" />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <Select label="Mode Import" value={mode} onChange={(e) => setMode(e.target.value as typeof mode)} className="sm:w-56">
              <option value="UPSERT">Update Existing</option>
              <option value="INSERT">Insert New</option>
              <option value="SKIP">Skip Existing</option>
            </Select>
            <Button onClick={doImport} loading={importing} size="lg">
              Konfirmasi Import ({valid.length})
            </Button>
          </div>

          {invalid.length > 0 ? (
            <div className="rounded-2xl bg-red-50 p-4 ring-1 ring-red-200">
              <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-red-700">
                <AlertTriangle className="w-4 h-4" /> Baris bermasalah ({invalid.length})
              </p>
              <ul className="space-y-1 text-xs text-red-700">
                {invalid.slice(0, 10).map((r) => (
                  <li key={r.rowNumber}>
                    Baris {r.rowNumber}: {r.errors.join(", ")} — {r.nim || "(nim kosong)"} {r.name}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-semibold text-slate-500">
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">No</th>
                  <th className="px-3 py-2">NIM</th>
                  <th className="px-3 py-2">Nama</th>
                  <th className="px-3 py-2">Jenis Kelamin</th>
                  <th className="px-3 py-2">Kelas</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.slice(0, 50).map((r) => (
                  <tr key={r.rowNumber}>
                    <td className="px-3 py-2 text-slate-400">{r.rowNumber}</td>
                    <td className="px-3 py-2 text-slate-700">{r.no_urut}</td>
                    <td className="px-3 py-2 text-slate-700">{r.nim}</td>
                    <td className="px-3 py-2 text-slate-700">{r.name}</td>
                    <td className="px-3 py-2 text-slate-700">{r.gender}</td>
                    <td className="px-3 py-2 text-slate-700">{r.class}</td>
                    <td className="px-3 py-2">
                      {r.errors.length === 0 ? (
                        <Badge tone="success">Valid</Badge>
                      ) : (
                        <Badge tone="danger">{r.errors[0]}</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 50 ? (
              <p className="px-3 py-2 text-xs text-slate-400">Menampilkan 50 dari {rows.length} baris.</p>
            ) : null}
          </div>
        </>
      ) : null}

      {summary ? (
        <div className="rounded-2xl bg-emerald-50 p-6 ring-1 ring-emerald-200">
          <div className="mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            <h2 className="text-lg font-bold text-emerald-900">Import Selesai</h2>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Ditambah" value={summary.inserted} tone="emerald" />
            <StatCard label="Diperbarui" value={summary.updated} tone="blue" />
            <StatCard label="Dilewati" value={summary.skipped} tone="amber" />
            <StatCard label="Gagal" value={summary.invalid} tone="red" />
          </div>
          <Button variant="secondary" className="mt-4" onClick={() => { setRows([]); setSummary(null); setFileName(""); }}>
            Import Lagi
          </Button>
        </div>
      ) : null}

      {rows.length === 0 && !parsing && !summary ? (
        <EmptyState title="Belum ada file" hint="Gunakan kolom no_urut, nim, nama, jenis_kelamin, dan kelas." />
      ) : null}

      <Modal open={showClear} title="Hapus Semua Data Mahasiswa" onClose={() => setShowClear(false)}>
        <div className="space-y-4">
          <div className="rounded-xl bg-red-50 p-4 ring-1 ring-red-200">
            <p className="flex items-center gap-2 text-sm font-semibold text-red-700">
              <AlertTriangle className="w-4 h-4" /> Peringatan
            </p>
            <p className="mt-1 text-sm text-red-700">
              Semua data mahasiswa akan dihapus permanen, termasuk QR Code dan data absensi yang terkait. Tindakan ini tidak dapat dibatalkan.
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={clearAllStudents} loading={clearing} className="flex-1 bg-red-600 hover:bg-red-700">
              Ya, Hapus Semua
            </Button>
            <Button variant="secondary" onClick={() => setShowClear(false)} className="flex-1">Batal</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: "slate" | "emerald" | "blue" | "amber" | "red" }) {
  const tones: Record<string, string> = {
    slate: "bg-slate-100 text-slate-700",
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
