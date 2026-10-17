export default function RecommendedCard({ title, code, thumbnailUrl, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-[160px] shrink-0 flex-col overflow-hidden rounded-3xl border border-border-subtle bg-bg-panel text-left shadow-sm transition-colors hover:shadow-md active:scale-[0.98] sm:w-auto sm:min-w-0"
    >
      <div className="aspect-[4/3] w-full overflow-hidden bg-bg-elevated">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={title}
            className="h-full w-full object-cover transition-transform duration-500"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-violet-soft">
            <span className="text-2xl font-bold text-accent/40">{(code || title || "?")[0]}</span>
          </div>
        )}
      </div>
      <div className="p-3.5">
        <p className="line-clamp-2 text-sm font-semibold leading-snug text-text-primary">{title}</p>
        {code && (
          <p className="mt-1.5 inline-block rounded-lg bg-accent-soft px-2 py-0.5 font-mono text-xs font-bold text-accent">
            {code}
          </p>
        )}
      </div>
    </button>
  );
}
