import { useEffect, useState } from "react";
import { Trash2, AlertTriangle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { hasRole } from "@/lib/auth";
import { useAuth } from "@/lib/auth-context";
import { useToasts } from "@/lib/use-toasts";
import { Badge, Button, EmptyState, Modal, Spinner } from "@/components/ui";

type AuditLog = {
  id: string;
  user_id: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

type ProfileMap = Record<string, string>;

export function AuditPage() {
  const { profile } = useAuth();
  const { success, error } = useToasts();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [profiles, setProfiles] = useState<ProfileMap>({});
  const [loading, setLoading] = useState(true);
  const [showClear, setShowClear] = useState(false);
  const [clearing, setClearing] = useState(false);

  const isAdmin = hasRole(profile, "ADMIN");

  const load = async () => {
    setLoading(true);
    const [{ data: l }, { data: p }] = await Promise.all([
      supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("profiles").select("id, name"),
    ]);
    setLogs((l as AuditLog[]) ?? []);
    const map: ProfileMap = {};
    (p as { id: string; name: string }[] ?? []).forEach((row) => { map[row.id] = row.name; });
    setProfiles(map);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const clearLogs = async () => {
    setClearing(true);
    const { data: deleted, error: err } = await supabase.from("audit_logs").delete().neq("id", "00000000-0000-0000-0000-000000000000").select("id");
    setClearing(false);
    setShowClear(false);
    if (err) {
      error("Gagal menghapus audit log.");
      return;
    }
    success(`${deleted?.length ?? 0} log berhasil dihapus.`);
    await load();
  };

  if (loading) return <Spinner label="Memuat audit log…" />;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Audit Log</h1>
          <p className="text-sm text-slate-500">Riwayat aktivitas penting dalam sistem.</p>
        </div>
        {isAdmin ? (
          <Button variant="ghost" onClick={() => setShowClear(true)} className="text-red-600 hover:bg-red-50">
            <Trash2 className="w-4 h-4" /> Hapus Semua Log
          </Button>
        ) : null}
      </div>

      {logs.length === 0 ? (
        <EmptyState title="Belum ada aktivitas" hint="Aktivitas scan, impor, dan perubahan akan muncul di sini." />
      ) : (
        <ul className="space-y-2">
          {logs.map((log) => (
            <li key={log.id} className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge tone="info">{log.action}</Badge>
                  <span className="text-sm text-slate-500">{log.target_type}</span>
                </div>
                <span className="text-xs text-slate-400">
                  {new Date(log.created_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-700">
                Oleh: <b>{log.user_id ? profiles[log.user_id] ?? "—" : "Sistem"}</b>
              </p>
              {Object.keys(log.metadata).length > 0 ? (
                <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-50 p-2 text-xs text-slate-600">
                  {JSON.stringify(log.metadata, null, 2)}
                </pre>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <Modal open={showClear} title="Hapus Semua Audit Log" onClose={() => setShowClear(false)}>
        <div className="space-y-4">
          <div className="rounded-xl bg-red-50 p-4 ring-1 ring-red-200">
            <p className="flex items-center gap-2 text-sm font-semibold text-red-700">
              <AlertTriangle className="w-4 h-4" /> Peringatan
            </p>
            <p className="mt-1 text-sm text-red-700">
              Semua riwayat aktivitas akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={clearLogs} loading={clearing} className="flex-1 bg-red-600 hover:bg-red-700">
              Ya, Hapus Semua Log
            </Button>
            <Button variant="secondary" onClick={() => setShowClear(false)} className="flex-1">Batal</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
