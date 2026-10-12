/**
 * Student stat tile — quiet and editorial: mono label, large tabular number,
 * one palette colour as a small marker. API unchanged.
 */
const ACCENTS = {
  teal: { dot: "bg-violet", soft: "bg-violet-soft text-violet dark:bg-violet/15" },
  blue: { dot: "bg-violet", soft: "bg-violet-soft text-violet dark:bg-violet/15" },
  violet: { dot: "bg-midnight dark:bg-white", soft: "bg-sand text-midnight dark:bg-white/10 dark:text-white" },
  orange: { dot: "bg-lemon-deep", soft: "bg-lemon-soft text-midnight dark:bg-lemon/15 dark:text-lemon" },
  flame: { dot: "bg-lemon-deep", soft: "bg-lemon-soft text-midnight dark:bg-lemon/15 dark:text-lemon" },
  pink: { dot: "bg-aqua-deep", soft: "bg-aqua-soft text-aqua-deep dark:bg-aqua/15 dark:text-aqua" },
};

export default function StudentKpiCard({ icon: Icon, value, label, accent = "teal", subtitle, circular = false }) {
  const a = ACCENTS[accent] || ACCENTS.teal;

  if (circular) {
    return (
      <div className="card-stitch flex min-w-[140px] flex-1 flex-col items-center justify-center p-6 text-center sm:min-w-0">
        <span className={`flex h-12 w-12 items-center justify-center rounded-full ${a.soft}`}>{Icon && <Icon size={19} strokeWidth={1.8} />}</span>
        <p className="mt-3 whitespace-pre-line text-sm font-semibold text-text-primary">{value}</p>
        {label && <p className="eyebrow mt-1 text-text-muted">{label}</p>}
      </div>
    );
  }

  return (
    <div className="card-stitch flex min-w-[140px] flex-1 flex-col p-5 sm:min-w-0 sm:p-6">
      <div className="flex items-center justify-between gap-2">
        <p className="eyebrow flex items-center gap-2 text-text-muted">
          <span className={`h-1.5 w-1.5 rounded-full ${a.dot}`} />
          {label}
        </p>
        {Icon && (
          <span className={`flex h-8 w-8 items-center justify-center rounded-full ${a.soft}`}>
            <Icon size={15} strokeWidth={1.9} />
          </span>
        )}
      </div>
      <p className="num mt-6 text-[2.5rem] font-light leading-none text-text-primary">{value}</p>
      {subtitle && <p className="mt-2 text-xs text-text-muted">{subtitle}</p>}
    </div>
  );
}
