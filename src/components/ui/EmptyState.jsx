export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className = "",
}) {
  return (
    <div
      role="status"
      className={`flex flex-col items-center justify-center gap-3 rounded-[1.25rem] border border-dashed border-border-strong bg-bg-panel px-6 py-16 text-center ${className}`}
    >
      {Icon && (
        <div
          className="flex h-14 w-14 items-center justify-center rounded-full bg-lemon-soft text-midnight dark:bg-lemon/10 dark:text-lemon"
          aria-hidden="true"
        >
          <Icon size={22} strokeWidth={1.75} />
        </div>
      )}
      <div className="max-w-sm space-y-1">
        <h3 className="!font-display text-[1.2rem] !font-[420] text-text-primary">{title}</h3>
        {description && (
          <p className="text-sm leading-relaxed text-text-secondary">{description}</p>
        )}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
