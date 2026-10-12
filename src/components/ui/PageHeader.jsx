export default function PageHeader({ title, description, actions, className = "" }) {
  return (
    <div
      className={`flex flex-col gap-4 pb-2 sm:flex-row sm:items-end sm:justify-between ${className}`}
    >
      <div className="min-w-0">
        <h1 className="font-display text-[2rem] font-[400] leading-tight tracking-[-0.025em] text-text-primary sm:text-[2.4rem]">{title}</h1>
        {description && (
          <p className="mt-2 max-w-2xl text-[0.95rem] text-text-secondary">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  );
}
