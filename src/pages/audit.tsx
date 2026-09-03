import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Badge, EmptyState, Spinner } from "@/components/ui";

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
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [profiles, setProfiles] = useState<ProfileMap>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: l }, { data: p }] = await Promise.all([
        supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(200),
        supabase.from("profiles").select("id, name"),
      ]);
      setLogs((l as AuditLog[]) ?? []);
      const map: ProfileMap = {};
      (p as { id: string; name: string }[] ?? []).forEach((row) => { map[row.id] = row.name; });
      setProfiles(map);
      setLoading(false);
    })();
  }, []);

  if (loading) return <Spinner label="Memuat audit log…" />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Audit Log</h1>
        <p className="text-sm text-slate-500">Riwayat aktivitas penting dalam sistem.</p>
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
    </div>
  );
}
