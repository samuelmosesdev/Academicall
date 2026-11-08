import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/**
 * Lightweight overlay used by the date and time pickers.
 * It can open on top of an existing <Modal>, so it captures Escape and Tab
 * before the parent modal's handlers see them.
 */
export default function PickerSheet({ open, onClose, title, children, footer }) {
  const titleId = useId();
  const panelRef = useRef(null);
  const closeRef = useRef(onClose);
  const returnFocus = useRef(null);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    returnFocus.current = document.activeElement;
    const panel = panelRef.current;
    const t = setTimeout(() => {
      const pref = panel?.querySelector("[data-autofocus]");
      (pref || panel)?.focus();
    }, 0);

    function onKey(e) {
      if (!panel) return;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        closeRef.current?.();
        return;
      }
      if (e.key !== "Tab") return;
      e.stopImmediatePropagation();
      const list = Array.from(
        panel.querySelectorAll('button:not([disabled]), [tabindex]:not([tabindex="-1"])')
      );
      if (!list.length) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (!panel.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey, true);
      returnFocus.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[130] flex items-end justify-center sm:items-center sm:p-6" role="presentation" style={{ top: 0, left: 0, right: 0, bottom: 0, width: "100%", height: "100%", minHeight: "100dvh" }}>
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close picker"
        onClick={onClose}
        className="animate-fade absolute inset-0 bg-midnight/45 backdrop-blur-[2px]"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="animate-pop relative z-10 w-full sm:max-w-[22rem] rounded-t-[1.6rem] border border-border-subtle bg-bg-panel px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 shadow-[var(--shadow-pop)] outline-none sm:rounded-[1.4rem] sm:pt-5"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border-strong sm:hidden" aria-hidden="true" />
        <div className="mb-4 flex items-center justify-between">
          <h3 id={titleId} className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-text-muted">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 flex h-8 w-8 items-center justify-center rounded-full text-text-muted transition hover:bg-bg-panel-alt hover:text-text-primary"
          >
            <X size={16} />
          </button>
        </div>
        {children}
        {footer && <div className="mt-5 flex items-center justify-end gap-2">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
