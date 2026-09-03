import { useEffect, useState } from "react";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { hasRole, isPending } from "@/lib/auth";
import { LoginPage } from "@/pages/login";
import { RoleSelectPage } from "@/pages/role-select";
import { Shell } from "@/components/shell";
import { DashboardPage } from "@/pages/dashboard";
import { ScannerPage } from "@/pages/scanner";
import { StudentsPage } from "@/pages/students";
import { AttendancePage } from "@/pages/attendance";
import { SessionsPage } from "@/pages/sessions";
import { ImportPage } from "@/pages/import";
import { ReportsPage } from "@/pages/reports";
import { AuditPage } from "@/pages/audit";
import { Spinner } from "@/components/ui";

function AppInner() {
  const { loading, profile } = useAuth();
  const [route, setRoute] = useState<string>(() => {
    const h = window.location.hash.replace("#", "");
    return h || "dashboard";
  });

  useEffect(() => {
    const onHash = () => {
      const h = window.location.hash.replace("#", "");
      setRoute(h || "dashboard");
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const navigate = (key: string) => {
    window.location.hash = key;
    setRoute(key);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Spinner label="Memuat…" />
      </div>
    );
  }

  if (!profile) {
    return <LoginPage />;
  }

  if (isPending(profile)) {
    return <RoleSelectPage />;
  }

  const guard = (allowed: ("ADMIN" | "SCANNER" | "VIEWER")[], page: React.ReactNode) => {
    if (hasRole(profile, ...allowed)) return page;
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
        <p className="text-lg font-bold text-slate-900">Akses ditolak</p>
        <p className="max-w-xs text-sm text-slate-500">
          Anda tidak memiliki izin membuka halaman ini.
        </p>
      </div>
    );
  };

  const active = route;

  return (
    <Shell active={active} onNavigate={navigate}>
      {active === "dashboard" ? <DashboardPage /> : null}
      {active === "scanner" ? guard(["ADMIN", "SCANNER"], <ScannerPage />) : null}
      {active === "students" ? guard(["ADMIN", "VIEWER"], <StudentsPage />) : null}
      {active === "attendance" ? guard(["ADMIN", "VIEWER"], <AttendancePage />) : null}
      {active === "sessions" ? guard(["ADMIN"], <SessionsPage />) : null}
      {active === "import" ? guard(["ADMIN"], <ImportPage />) : null}
      {active === "reports" ? guard(["ADMIN", "VIEWER"], <ReportsPage />) : null}
      {active === "audit" ? guard(["ADMIN"], <AuditPage />) : null}
    </Shell>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}
