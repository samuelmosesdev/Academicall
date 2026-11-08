import { Link } from "react-router-dom";
import { CheckCircle2, ChevronRight } from "lucide-react";

/**
 * "Needs your attention": things waiting on this person, each a link to where it is
 * handled. Items with a null count are not shown (no permission, or the lookup failed).
 * Shows a calm "all caught up" state when everything is zero.
 */
export default function AttentionQueue({ items, loading = false }) {
  const shown = items.filter((i) => i.count !== null && i.count !== undefined);
  const waiting = shown.filter((i) => i.count > 0);

  if (loading) {
    return <div className="h-[4.5rem] animate-pulse rounded-2xl border border-border-subtle bg-bg-panel" aria-hidden="true" />;
  }
  if (shown.length === 0) return null;

  return (
    <section aria-label="Needs your attention" className="rounded-2xl border border-border-subtle bg-bg-panel p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text-primary">Needs your attention</h2>
        {waiting.length === 0 && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-accent">
            <CheckCircle2 size={14} /> All caught up
          </span>
        )}
      </div>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {shown.map(({ key, label, count, to, icon: Icon, hint }) => (
          <li key={key}>
            <Link
              to={to}
              className={`group flex items-center gap-3 rounded-xl border px-3.5 py-3 transition-colors ${
                count > 0
                  ? "border-accent/30 bg-accent-soft hover:border-accent/60"
                  : "border-border-subtle hover:bg-bg-panel-alt"
              }`}
            >
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${count > 0 ? "bg-accent text-bg-app" : "bg-bg-panel-alt text-text-muted"}`}>
                <Icon size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="num block text-lg font-semibold leading-none text-text-primary">{count}</span>
                <span className="mt-1 block truncate text-xs text-text-secondary">{label}</span>
                {hint && count > 0 && <span className="block truncate text-[0.7rem] text-text-muted">{hint}</span>}
              </span>
              <ChevronRight size={15} className="shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
