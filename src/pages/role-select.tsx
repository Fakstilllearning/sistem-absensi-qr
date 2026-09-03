import { useState } from "react";
import { ShieldCheck, ScanLine, Eye, ArrowRight } from "lucide-react";
import { setOwnRole, friendlyAuthError } from "@/lib/auth";
import { useAuth } from "@/lib/auth-context";
import { BrandLockup } from "@/components/brand";
import { Button } from "@/components/ui";
import type { Role } from "@/lib/supabase";

const ROLE_INFO: { role: Role; label: string; icon: React.ReactNode; desc: string }[] = [
  {
    role: "ADMIN",
    label: "Admin",
    icon: <ShieldCheck className="h-6 w-6" />,
    desc: "Kelola sesi, import data, koreksi absensi, dan lihat audit log.",
  },
  {
    role: "SCANNER",
    label: "Scanner",
    icon: <ScanLine className="h-6 w-6" />,
    desc: "Pindai QR Code mahasiswa untuk mencatat kehadiran.",
  },
  {
    role: "VIEWER",
    label: "Viewer",
    icon: <Eye className="h-6 w-6" />,
    desc: "Lihat dashboard, data mahasiswa, absensi, dan laporan.",
  },
];

export function RoleSelectPage() {
  const { refresh } = useAuth();
  const [selected, setSelected] = useState<Role | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const confirm = async () => {
    if (!selected) return;
    setErr(null);
    setLoading(true);
    try {
      await setOwnRole(selected);
      await refresh();
    } catch (e) {
      setErr(friendlyAuthError((e as Error).message));
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-emerald-50 via-slate-50 to-emerald-50 px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <BrandLockup />
          <p className="text-sm text-slate-500">Pilih peran Anda untuk melanjutkan</p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h1 className="mb-1 text-xl font-bold text-slate-900">Pilih Peran</h1>
          <p className="mb-5 text-sm text-slate-500">
            Pilihan ini hanya bisa dilakukan sekali. Hubungi admin jika perlu diubah nanti.
          </p>

          <div className="space-y-3">
            {ROLE_INFO.map((r) => (
              <button
                key={r.role}
                onClick={() => setSelected(r.role)}
                className={`flex w-full items-start gap-4 rounded-xl border-2 p-4 text-left transition-colors ${
                  selected === r.role
                    ? "border-emerald-500 bg-emerald-50"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <span
                  className={`mt-0.5 rounded-lg p-2 ${
                    selected === r.role ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {r.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-900">{r.label}</p>
                  <p className="text-xs text-slate-500">{r.desc}</p>
                </div>
              </button>
            ))}
          </div>

          {err ? (
            <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>
          ) : null}

          <Button
            onClick={confirm}
            loading={loading}
            disabled={!selected}
            size="lg"
            className="mt-5 w-full"
          >
            Konfirmasi <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
