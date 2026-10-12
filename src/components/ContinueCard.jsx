import { Play } from "lucide-react";

export default function ContinueCard({ title, subtitle, progressPct = 0, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-4 rounded-3xl border border-border-subtle bg-bg-panel p-4 text-left shadow-sm transition-all hover:border-accent/30 hover:shadow-md active:scale-[0.99]"
    >
      <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-accent/20 to-accent/5">
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="h-10 w-10 rounded-full border-[3px] border-accent/20"
            style={{
              background: `conic-gradient(var(--color-accent) ${progressPct * 3.6}deg, transparent 0)`,
            }}
          />
          <span className="absolute text-[10px] font-bold text-accent">{Math.round(progressPct)}%</span>
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-text-primary">{title}</p>
        <p className="mt-0.5 truncate text-xs text-text-secondary">{subtitle}</p>
        <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-bg-elevated">
          <div
            className="h-full rounded-full bg-midnight transition-all duration-500"
            style={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }}
          />
        </div>
      </div>

      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-white shadow-md shadow-accent/25 transition group-hover:scale-105">
        <Play size={16} fill="currentColor" className="ml-0.5" />
      </span>
    </button>
  );
}
