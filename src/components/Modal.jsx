import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export default function Modal({ title, open, onClose, children, size = "md" }) {
  const titleId = useId();
  const panelRef = useRef(null);
  const previouslyFocused = useRef(null);
  const closeRef = useRef(onClose);
  const maxWidth =
    size === "sm" ? "max-w-sm" : size === "lg" ? "max-w-2xl" : "max-w-md";

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
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="presentation"
      style={{ top: 0, left: 0, right: 0, bottom: 0, width: "100%", height: "100%", minHeight: "100dvh" }}
    >
      <button type="button" className="absolute inset-0 bg-black/60" aria-label="Close dialog" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`relative z-10 w-full ${maxWidth} max-h-[min(90dvh,90vh)] overflow-y-auto rounded-2xl border border-border-subtle bg-bg-panel p-5 sm:p-6 shadow-xl outline-none`}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 id={titleId} className="text-base font-semibold text-text-primary">{title}</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-text-muted hover:bg-bg-elevated" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );

  return createPortal(node, document.body);
}
