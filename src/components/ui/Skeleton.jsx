/**
 * Skeleton placeholders: they hold the space content will fill, so the page
 * does not jump when data arrives. The label is announced to screen readers.
 */
export function Skel({ className = "", style }) {
  return <span aria-hidden="true" className={`ac-skel block ${className}`} style={style} />;
}

export function SkeletonCards({ count = 3, label = "Loading…", grid = false, className = "" }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className={`${grid ? "grid gap-3 sm:grid-cols-2" : "space-y-3"} ${className}`}>
      <span className="sr-only">{label}</span>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="ac-skel-card">
          <div className="flex items-start gap-3">
            <Skel className="h-10 w-10 shrink-0 !rounded-full" />
            <div className="min-w-0 flex-1 space-y-2.5 pt-0.5">
              <Skel className="h-3.5" style={{ width: `${46 + ((i * 17) % 30)}%` }} />
              <Skel className="h-3" style={{ width: `${70 + ((i * 11) % 22)}%` }} />
              <Skel className="h-3" style={{ width: `${32 + ((i * 23) % 26)}%` }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonPage({ label = "Loading…", compact = false }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className={compact ? "py-4" : "py-6"}>
      <span className="sr-only">{label}</span>
      {!compact && (
        <div className="mb-6 space-y-3">
          <Skel className="h-3 w-24" />
          <Skel className="h-8 w-2/5" />
          <Skel className="h-3.5 w-3/5" />
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="ac-skel-card space-y-3"><Skel className="h-3 w-1/3" /><Skel className="h-6 w-1/2" /></div>
        ))}
      </div>
      <div className="mt-4"><SkeletonCards count={compact ? 2 : 3} label={label} /></div>
    </div>
  );
}
