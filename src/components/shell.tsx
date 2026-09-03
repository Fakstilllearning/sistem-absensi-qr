import { useState, type ReactNode } from "react";
import { Menu, X, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { hasRole } from "@/lib/auth";
import { BrandLockup, LogoUpiFpok } from "./brand";
import { Badge } from "./ui";

type NavItem = {
  key: string;
  label: string;
  roles: ("ADMIN" | "SCANNER" | "VIEWER")[];
};

const NAV: NavItem[] = [
  { key: "dashboard", label: "Dashboard", roles: ["ADMIN", "SCANNER", "VIEWER"] },
  { key: "scanner", label: "Scanner", roles: ["ADMIN", "SCANNER"] },
  { key: "students", label: "Mahasiswa", roles: ["ADMIN", "VIEWER"] },
  { key: "attendance", label: "Absensi", roles: ["ADMIN", "VIEWER"] },
  { key: "sessions", label: "Sesi", roles: ["ADMIN"] },
  { key: "import", label: "Import Data", roles: ["ADMIN"] },
  { key: "reports", label: "Laporan", roles: ["ADMIN", "VIEWER"] },
  { key: "audit", label: "Audit Log", roles: ["ADMIN"] },
];

export function Shell({
  active,
  onNavigate,
  children,
}: {
  active: string;
  onNavigate: (key: string) => void;
  children: ReactNode;
}) {
  const { profile, signOut } = useAuth();
  const [open, setOpen] = useState(false);

  const items = NAV.filter((n) => hasRole(profile, ...n.roles));
  const roleTone =
    profile?.role === "ADMIN" ? "info" : profile?.role === "SCANNER" ? "success" : "neutral";

  const NavList = () => (
    <nav className="flex flex-col gap-1">
      {items.map((item) => (
        <button
          key={item.key}
          onClick={() => {
            onNavigate(item.key);
            setOpen(false);
          }}
          className={`rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors ${
            active === item.key
              ? "bg-emerald-50 text-emerald-700"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
              onClick={() => setOpen((v) => !v)}
              aria-label="Buka menu"
            >
              {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <BrandLockup />
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-slate-800">{profile?.name}</p>
              <div className="flex items-center justify-end gap-1.5">
                <Badge tone={roleTone}>{profile?.role}</Badge>
              </div>
            </div>
            <button
              onClick={signOut}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6">
        <aside className="hidden w-60 shrink-0 lg:block">
          <div className="sticky top-20 rounded-2xl bg-white p-3 ring-1 ring-slate-200">
            <NavList />
            <div className="mt-4 flex items-center justify-center border-t border-slate-100 pt-4">
              <LogoUpiFpok className="h-12 w-auto" />
            </div>
          </div>
        </aside>

        {open ? (
          <div className="fixed inset-0 top-[57px] z-20 bg-slate-900/40 lg:hidden" onClick={() => setOpen(false)}>
            <div
              className="absolute left-0 top-0 h-full w-72 bg-white p-3 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <NavList />
            </div>
          </div>
        ) : null}

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
