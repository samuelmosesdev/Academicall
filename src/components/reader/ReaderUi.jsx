/** Shared bits for the reader chrome (PDF + image readers). Colours come from reader.css variables. */

export function ReaderButton({
  label,
  onClick,
  disabled = false,
  active = false,
  children,
  className = "",
  ...rest
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active || undefined}
      title={label}
      data-active={active ? "true" : undefined}
      className={`reader-btn flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors disabled:opacity-30 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function ReaderDivider({ className = "" }) {
  return <span aria-hidden className={`reader-line mx-1 h-5 w-px shrink-0 ${className}`} />;
}

/** Two- or three-way segmented control used in the display menu / mobile sheet. */
export function ReaderSegment({ value, onChange, options, label }) {
  return (
    <div role="radiogroup" aria-label={label} className="reader-seg flex rounded-lg p-0.5">
      {options.map((option) => {
        const Icon = option.icon;
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            data-active={active ? "true" : undefined}
            onClick={() => onChange(option.value)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition"
          >
            {Icon && <Icon size={14} />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function ReaderMenuRow({ label, children }) {
  return (
    <div className="space-y-1.5">
      <p className="reader-muted text-[0.7rem] font-medium uppercase tracking-wide">{label}</p>
      {children}
    </div>
  );
}

/** Lightweight anchored popover with an invisible click-away layer. */
export function ReaderPopover({ open, onClose, children, align = "right", className = "" }) {
  if (!open) return null;
  return (
    <>
      <button
        type="button"
        aria-label="Close menu"
        tabIndex={-1}
        className="fixed inset-0 z-[5] cursor-default"
        onClick={onClose}
      />
      <div
        role="menu"
        className={`reader-bar absolute top-full z-10 mt-1.5 rounded-xl border p-3 shadow-[0_12px_32px_-12px_rgba(15,3,38,0.35)] ${
          align === "right" ? "right-0" : "left-0"
        } ${className}`}
      >
        {children}
      </div>
    </>
  );
}

/** Bottom sheet for phones. */
export function ReaderSheet({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex flex-col justify-end md:hidden" role="dialog" aria-label={title}>
      <button type="button" aria-label="Close" className="flex-1 bg-midnight/40" onClick={onClose} />
      <div className="reader-sheet max-h-[80vh] overflow-y-auto rounded-t-2xl px-4 pt-2">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-current opacity-20" />
        {children}
      </div>
    </div>
  );
}
