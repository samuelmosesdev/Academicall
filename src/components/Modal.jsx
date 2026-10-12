import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export default function Modal({ title, open, onClose, children, size = "md" }) {
  const titleId = useId();
  const panelRef = useRef(null);
  const previouslyFocused = useRef(null);
  const closeRef = useRef(onClose);
  const maxWidth =
    size === "sm" ? "sm:max-w-sm" : size === "lg" ? "sm:max-w-2xl" : "sm:max-w-lg";

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement;
    const panel = panelRef.current;
    const focusable = panel?.querySelector(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    (focusable || panel)?.focus();

    function onKeyDown(e) {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeRef.current?.();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const nodes = panel.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const list = Array.from(nodes).filter(
        (el) => !el.hasAttribute("disabled") && el.getAttribute("aria-hidden") !== "true"
      );
      if (list.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  const node = (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-6"
      role="presentation"
      style={{ top: 0, left: 0, right: 0, bottom: 0, width: "100%", height: "100%", minHeight: "100dvh" }}
    >
      <button type="button" className="animate-fade absolute inset-0 bg-midnight/55 backdrop-blur-[3px]" aria-label="Close dialog" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`animate-pop relative z-10 w-full ${maxWidth} max-h-[min(92dvh,92vh)] overflow-y-auto rounded-t-[1.75rem] border border-border-subtle bg-bg-panel px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 shadow-[var(--shadow-pop)] outline-none sm:rounded-[1.75rem] sm:p-8`}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border-strong sm:hidden" aria-hidden="true" />
        <div className="mb-6 flex items-start justify-between gap-4">
          <h2 id={titleId} className="!font-display text-[1.45rem] !font-[420] leading-tight !tracking-[-0.02em] text-text-primary">{title}</h2>
          <button type="button" onClick={onClose} className="-mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bg-panel-alt text-text-muted transition hover:bg-bg-elevated hover:text-text-primary" aria-label="Close">
            <X size={17} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );

  return createPortal(node, document.body);
}
