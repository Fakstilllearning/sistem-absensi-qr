import { useCallback, useEffect, useRef, useState } from "react";
import { Html5Qrcode, type QrcodeSuccessCallback } from "html5-qrcode";
import { AlertTriangle, CheckCircle2, Camera, XCircle, ScanLine } from "lucide-react";
import { supabase, type ScanResult } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useActiveSession } from "@/lib/use-active-session";
import { Badge, Button, Spinner, statusTone } from "@/components/ui";
import { BrandLockup } from "@/components/brand";

type Feedback =
  | { kind: "idle" }
  | { kind: "success"; data: ScanResult }
  | { kind: "duplicate"; data: ScanResult }
  | { kind: "invalid" }
  | { kind: "session_closed" }
  | { kind: "unauthorized" }
  | { kind: "network"; message: string }
  | { kind: "camera_error"; message: string };

const SCAN_LOCK_MS = 1800;

export function ScannerPage() {
  const { profile } = useAuth();
  const { session, loading: sessionLoading } = useActiveSession();
  const [feedback, setFeedback] = useState<Feedback>({ kind: "idle" });
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lockRef = useRef(false);
  const containerId = "qr-reader";

  const handleScan = useCallback(
    async (decodedText: string) => {
      if (lockRef.current) return;
      if (!session) return;

      lockRef.current = true;
      setFeedback({ kind: "idle" });

      const callRpc = async () => {
        return supabase.rpc("record_attendance", {
          p_qr_token: decodedText.trim(),
          p_session_id: session.id,
        });
      };

      type RpcResult = Awaited<ReturnType<typeof callRpc>>;

      try {
        let data: RpcResult["data"] = null;
        let error: RpcResult["error"] = null;
        let lastErr: unknown = null;

        for (let attempt = 0; attempt < 3; attempt++) {
          const result = await callRpc();
          data = result.data;
          error = result.error;
          if (!error || error.message.includes("UNAUTHORIZED") || error.message.includes("SESSION_CLOSED") || error.message.includes("INVALID_QR")) {
            lastErr = null;
            break;
          }
          lastErr = error;
          if (attempt < 2) await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
        }

        if (lastErr) {
          error = lastErr as typeof error;
        }

        if (error) {
          const msg = error.message;
          if (msg.includes("UNAUTHORIZED")) {
            setFeedback({ kind: "unauthorized" });
          } else if (msg.includes("SESSION_CLOSED")) {
            setFeedback({ kind: "session_closed" });
          } else if (msg.includes("INVALID_QR")) {
            setFeedback({ kind: "invalid" });
          } else {
            setFeedback({ kind: "network", message: "Tidak dapat terhubung ke server. Pastikan ada koneksi internet (WiFi atau data seluler) lalu coba pindai ulang." });
          }
        } else if (data && data.length > 0) {
          const row = data[0] as ScanResult;
          if (row.result === "SUCCESS") {
            setFeedback({ kind: "success", data: row });
            if (navigator.vibrate) navigator.vibrate(120);
          } else {
            setFeedback({ kind: "duplicate", data: row });
            if (navigator.vibrate) navigator.vibrate([60, 40, 60]);
          }
        }
      } catch {
        setFeedback({ kind: "network", message: "Koneksi terputus saat menyimpan absensi. Periksa koneksi internet Anda lalu pindai ulang QR Code." });
      } finally {
        setTimeout(() => {
          lockRef.current = false;
        }, SCAN_LOCK_MS);
      }
    },
    [session]
  );

  const startCamera = useCallback(async () => {
    if (scannerRef.current || cameraStarting) return;
    setCameraStarting(true);
    try {
      const scanner = new Html5Qrcode(containerId, {
        verbose: false,
        experimentalFeatures: { useBarCodeDetectorIfSupported: true },
      });
      scannerRef.current = scanner;

      const onDetected: QrcodeSuccessCallback = (decodedText) => {
        void handleScan(decodedText);
      };

      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 }, aspectRatio: 1 },
        onDetected,
        () => {}
      );
      setCameraReady(true);
      setFeedback({ kind: "idle" });
    } catch (err) {
      setFeedback({
        kind: "camera_error",
        message: "Izin kamera ditolak. Aktifkan akses kamera pada pengaturan browser.",
      });
    } finally {
      setCameraStarting(false);
    }
  }, [cameraStarting, handleScan]);

  useEffect(() => {
    return () => {
      const s = scannerRef.current;
      if (s) {
        s.stop()
          .then(() => s.clear())
          .catch(() => {})
          .finally(() => {
            scannerRef.current = null;
          });
      }
    };
  }, []);

  if (sessionLoading) return <Spinner label="Memuat sesi aktif…" />;

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <AlertTriangle className="w-10 h-10 text-amber-500" />
        <p className="text-lg font-bold text-slate-900">Belum ada sesi terbuka</p>
        <p className="max-w-xs text-sm text-slate-500">
          Admin harus membuka sesi absensi sebelum scanner dapat digunakan.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <div className="flex items-center justify-between rounded-xl bg-white p-3 ring-1 ring-slate-200">
        <BrandLockup compact />
        <div className="text-right">
          <p className="text-xs text-slate-500">{profile?.name}</p>
          <Badge tone="success">{session.status}</Badge>
        </div>
      </div>

      <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
        <p className="text-xs font-medium text-slate-500">Sesi aktif</p>
        <p className="text-sm font-bold text-slate-900">{session.name}</p>
        <p className="text-xs text-slate-500">
          {new Date(session.session_date).toLocaleDateString("id-ID", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
      </div>

      <div className="relative overflow-hidden rounded-2xl bg-slate-900 ring-1 ring-slate-800">
        <div id={containerId} className="aspect-square w-full" />
        {!cameraReady ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-900 p-6 text-center">
            <Camera className="w-10 h-10 text-emerald-400" />
            <p className="text-sm text-slate-200">
              Arahkan kamera ke QR Code pada buku kaderisasi.
            </p>
            <Button onClick={startCamera} loading={cameraStarting} size="lg" variant="success">
              <ScanLine className="w-5 h-5" /> Buka Kamera
            </Button>
          </div>
        ) : (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-60 w-60 rounded-xl border-4 border-emerald-400/80 shadow-[0_0_0_1000px_rgba(0,0,0,0.35)]" />
          </div>
        )}
      </div>

      <FeedbackCard feedback={feedback} />
    </div>
  );
}

function FeedbackCard({ feedback }: { feedback: Feedback }) {
  if (feedback.kind === "idle") {
    return (
      <div className="rounded-2xl bg-white p-4 text-center ring-1 ring-slate-200">
        <p className="text-sm font-medium text-slate-500">Menunggu pemindaian QR…</p>
      </div>
    );
  }

  if (feedback.kind === "success") {
    const d = feedback.data;
    return (
      <Card tone="success" title="ABSENSI BERHASIL" icon={<CheckCircle2 className="w-6 h-6" />}>
        <Row label="Nama" value={d.student_name} />
        <Row label="NIM" value={d.student_nim} />
        <Row label="Kelas" value={d.student_class} />
        <Row
          label="Waktu"
          value={d.scanned_at ? new Date(d.scanned_at).toLocaleTimeString("id-ID") : "—"}
        />
        <div className="mt-2">
          <Badge tone={statusTone(d.attendance_status)}>{d.attendance_status}</Badge>
        </div>
      </Card>
    );
  }

  if (feedback.kind === "duplicate") {
    const d = feedback.data;
    return (
      <Card tone="warning" title="SUDAH ABSEN" icon={<AlertTriangle className="w-6 h-6" />}>
        <Row label="Nama" value={d.student_name} />
        <Row label="NIM" value={d.student_nim} />
        <Row
          label="Absen sebelumnya"
          value={d.scanned_at ? new Date(d.scanned_at).toLocaleTimeString("id-ID") : "—"}
        />
        <div className="mt-2">
          <Badge tone={statusTone(d.attendance_status)}>{d.attendance_status}</Badge>
        </div>
      </Card>
    );
  }

  if (feedback.kind === "invalid") {
    return (
      <Card tone="danger" title="QR TIDAK VALID" icon={<XCircle className="w-6 h-6" />}>
        <p className="text-sm text-slate-700">QR Code tidak dikenali atau tidak terdaftar.</p>
      </Card>
    );
  }

  if (feedback.kind === "session_closed") {
    return (
      <Card tone="warning" title="SESI DITUTUP" icon={<AlertTriangle className="w-6 h-6" />}>
        <p className="text-sm text-slate-700">Absensi untuk sesi ini sudah ditutup.</p>
      </Card>
    );
  }

  if (feedback.kind === "unauthorized") {
    return (
      <Card tone="danger" title="TIDAK BERWENANG" icon={<XCircle className="w-6 h-6" />}>
        <p className="text-sm text-slate-700">Anda tidak memiliki akses melakukan absensi.</p>
      </Card>
    );
  }

  if (feedback.kind === "camera_error") {
    return (
      <Card tone="danger" title="KAMERA" icon={<XCircle className="w-6 h-6" />}>
        <p className="text-sm text-slate-700">{feedback.message}</p>
      </Card>
    );
  }

  return (
    <Card tone="danger" title="KONEKSI BERMASALAH" icon={<AlertTriangle className="w-6 h-6" />}>
      <p className="text-sm text-slate-700">{feedback.message}</p>
    </Card>
  );
}

function Card({
  tone,
  title,
  icon,
  children,
}: {
  tone: "success" | "warning" | "danger";
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const tones: Record<string, string> = {
    success: "bg-emerald-50 ring-emerald-200 text-emerald-900",
    warning: "bg-amber-50 ring-amber-200 text-amber-900",
    danger: "bg-red-50 ring-red-200 text-red-900",
  };
  const iconColor: Record<string, string> = {
    success: "text-emerald-600",
    warning: "text-amber-600",
    danger: "text-red-600",
  };
  return (
    <div className={`rounded-2xl p-5 ring-1 ${tones[tone]}`}>
      <div className="mb-2 flex items-center gap-2">
        <span className={iconColor[tone]}>{icon}</span>
        <p className="text-lg font-bold">{title}</p>
      </div>
      <div className="space-y-1 text-sm">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-900">{value}</span>
    </div>
  );
}
