export function LogoHmp({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <img
      src="/LOGO_HMP_PJKR.jpg.jpeg"
      alt="Logo HMP PJKR"
      className={`shrink-0 object-contain ${className}`}
    />
  );
}

export function LogoUpiFpok({ className = "h-10 w-auto" }: { className?: string }) {
  return (
    <img
      src="/LOGO_UPI_FPOK.jpeg"
      alt="Logo UPI FPOK"
      className={`shrink-0 object-contain ${className}`}
    />
  );
}

export function BrandLockup({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <LogoHmp className="h-10 w-10" />
      <div className="leading-tight">
        <p className={`font-bold text-slate-900 ${compact ? "text-sm" : "text-base"}`}>
          Absensi Kaderisasi
        </p>
        <p className="text-xs font-medium text-emerald-700">PJKR UPI 2026</p>
      </div>
    </div>
  );
}
