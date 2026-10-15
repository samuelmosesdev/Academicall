import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Search, X } from "lucide-react";

/** Debounced search box used by every directory and catalogue page. */
export function SearchField({ value, onChange, placeholder = "Search", delay = 250, className = "", autoFocus = false }) {
  const [text, setText] = useState(value || "");
  useEffect(() => { setText(value || ""); }, [value]);
  useEffect(() => {
    if (text === (value || "")) return undefined;
    const t = setTimeout(() => onChange(text), delay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);
  return (
    <label className={`relative block ${className}`}>
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
      <input
        className="acx-input pl-9 pr-8"
        value={text}
        autoFocus={autoFocus}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        type="search"
      />
      {text && (
        <button type="button" onClick={() => { setText(""); onChange(""); }} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-text-muted hover:text-text-primary" aria-label="Clear search">
          <X size={13} />
        </button>
      )}
    </label>
  );
}

/** Sortable column header. sort = { key, dir }. */
export function SortTh({ k, sort, onSort, children, className = "" }) {
  const on = sort?.key === k;
  return (
    <th className={className} aria-sort={on ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
      <button type="button" className={on ? "is-on" : ""} onClick={() => onSort({ key: k, dir: on && sort.dir === "asc" ? "desc" : "asc" })}>
        {children}
        {on ? (sort.dir === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />) : null}
      </button>
    </th>
  );
}

/** "21–40 of 1,634" + previous / next + page size. */
export function Pager({ page, pageSize, total, onPage, onPageSize, sizes = [25, 50, 100] }) {
  const pages = Math.max(1, Math.ceil((total || 0) / pageSize));
  const from = total ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(total || 0, page * pageSize);
  return (
    <div className="acx-pager">
      <span>{total ? `${from.toLocaleString()}–${to.toLocaleString()} of ${total.toLocaleString()}` : "No results"}</span>
      <div className="flex items-center gap-2">
        {onPageSize && (
          <select className="acx-select !py-1 !text-xs" value={pageSize} onChange={(e) => onPageSize(Number(e.target.value))} aria-label="Rows per page">
            {sizes.map((s) => <option key={s} value={s}>{s} per page</option>)}
          </select>
        )}
        <div className="acx-seg">
          <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page"><ChevronLeft size={14} /></button>
          <button type="button" className="is-on" aria-current="page">{page} / {pages}</button>
          <button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page"><ChevronRight size={14} /></button>
        </div>
      </div>
    </div>
  );
}

/** Right-hand panel for record details and edit forms. */
export function Drawer({ open, onClose, title, subtitle, actions, children }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <>
      <div className="acx-drawer-bg" onClick={onClose} aria-hidden="true" />
      <aside className="acx-drawer" role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : undefined}>
        <div className="acx-drawer-head">
          <div className="min-w-0">
            {subtitle && <div className="mb-1 text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">{subtitle}</div>}
            <h2 className="line-clamp-3 font-display text-[1.3rem] leading-tight text-text-primary">{title}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {actions}
            <button type="button" className="acx-icon-btn" onClick={onClose} aria-label="Close"><X size={15} /></button>
          </div>
        </div>
        <div className="acx-drawer-body">{children}</div>
      </aside>
    </>,
    document.body,
  );
}

/** Small labelled form control wrapper. */
export function Field({ label, error, hint, children, className = "" }) {
  return (
    <label className={`block ${className}`}>
      {label && <span className="acx-label">{label}</span>}
      {children}
      {hint && !error && <span className="mt-1 block text-[0.7rem] text-text-muted">{hint}</span>}
      {error && <span className="acx-field-err">{error}</span>}
    </label>
  );
}

/** Loading placeholder rows for tables. */
export function SkeletonRows({ cols = 5, rows = 6 }) {
  return Array.from({ length: rows }).map((_, i) => (
    <tr key={i} aria-hidden="true">
      {Array.from({ length: cols }).map((__, j) => (
        <td key={j}><span className="block h-3 animate-pulse rounded bg-bg-elevated" style={{ width: `${40 + ((i * 7 + j * 13) % 50)}%` }} /></td>
      ))}
    </tr>
  ));
}
