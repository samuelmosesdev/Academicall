import { TrendingUp } from "lucide-react";

export default function KpiCard({ label, value, trend, highlight = false, icon: Icon }) {
  return (
    <div
      className={`group relative flex flex-col justify-between overflow-hidden rounded-[1.25rem] p-6 transition-all duration-300 animate-fade-in-up ${
        highlight
          ? "bg-midnight text-white dark:bg-midnight-2 dark:ring-1 dark:ring-white/10"
          : "card-elevated text-text-primary"
      }`}
    >
      {/* subtle shine */}
      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100">
      </div>

      <div className="flex items-start justify-between">
        <span
          className={`text-sm font-medium ${
            highlight ? "text-white/65" : "text-text-secondary"
          }`}
        >
          {label}
        </span>
        {Icon && (
          <span
            className={`flex h-9 w-9 items-center justify-center rounded-xl ${
              highlight ? "bg-white/10 text-lemon" : "bg-accent-soft text-accent"
            }`}
          >
            <Icon size={18} strokeWidth={2} />
          </span>
        )}
      </div>

      <div className="mt-4 flex items-end justify-between">
        <span className="num text-[2.4rem] font-light leading-none">{value}</span>
        {trend && (
          <span
            className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
              highlight
                ? "bg-white/10 text-lemon"
                : "bg-accent-soft text-accent"
            }`}
          >
            <TrendingUp size={12} />
            {trend}
          </span>
        )}
      </div>
    </div>
  );
}
