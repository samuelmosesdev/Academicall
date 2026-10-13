import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import Modal from "../Modal";
import { registerDialogs } from "../../lib/dialogs";

const DANGER_RE = /(delete|remove|reject|trash|leave|revoke|discard|cancel request|withdraw)/i;

const TONES = {
  success: { icon: CheckCircle2, ring: "border-aqua-deep/25", iconCls: "bg-aqua-soft text-aqua-deep" },
  error: { icon: XCircle, ring: "border-status-danger/25", iconCls: "bg-status-danger/10 text-status-danger" },
  info: { icon: Info, ring: "border-violet/20", iconCls: "bg-violet-soft text-violet" },
  warning: { icon: AlertTriangle, ring: "border-status-warning/30", iconCls: "bg-lemon-soft text-midnight" },
};

function Toast({ toast, onClose }) {
  const tone = TONES[toast.tone] || TONES.info;
  const Icon = tone.icon;
  useEffect(() => {
    const ms = toast.duration ?? (toast.tone === "error" ? 6500 : 4000);
    if (!ms) return undefined;
    const t = setTimeout(() => onClose(toast.id), ms);
    return () => clearTimeout(t);
  }, [toast, onClose]);
  return (
    <div
      role={toast.tone === "error" ? "alert" : "status"}
      className={`toast-in pointer-events-auto flex w-full items-start gap-3 rounded-2xl border ${tone.ring} bg-bg-panel px-4 py-3 shadow-[var(--shadow-pop)]`}
    >
      <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${tone.iconCls}`}>
        <Icon size={15} />
      </span>
      <div className="min-w-0 flex-1 py-0.5">
        {toast.title && <p className="text-sm font-semibold text-text-primary">{toast.title}</p>}
        <p className="break-words text-sm leading-snug text-text-secondary">{toast.message}</p>
        {toast.action && (
          <button
            type="button"
            onClick={() => { toast.action.onClick?.(); onClose(toast.id); }}
            className="mt-1.5 text-xs font-semibold text-violet hover:underline"
          >
            {toast.action.label}
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={() => onClose(toast.id)}
        className="-mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-text-muted hover:bg-bg-panel-alt hover:text-text-primary"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  );
}

/**
 * Mount once near the root. Provides branded confirm / prompt dialogs and toasts
 * for the whole app (see lib/dialogs.js).
 */
export default function DialogProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [dialog, setDialog] = useState(null); // { kind, message, opts, resolve }
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const queue = useRef([]);
  const seq = useRef(0);

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const openNext = useCallback(() => {
    setDialog((current) => {
      if (current || !queue.current.length) return current;
      const next = queue.current.shift();
      setValue(next.opts.defaultValue || "");
      setError("");
      return next;
    });
  }, []);

  const enqueue = useCallback(
    (kind, message, opts) =>
      new Promise((resolve) => {
        queue.current.push({ kind, message, opts: opts || {}, resolve });
        openNext();
      }),
    [openNext]
  );

  const api = useMemo(
    () => ({
      toast: (t) => {
        seq.current += 1;
        const id = seq.current;
        setToasts((list) => [...list.slice(-3), { id, ...t }]);
        return id;
      },
      alert: (message, opts) => enqueue("alert", message, opts),
      confirm: (message, opts) => enqueue("confirm", message, opts),
      prompt: (message, opts) => enqueue("prompt", message, opts),
    }),
    [enqueue]
  );

  useEffect(() => {
    registerDialogs(api);
    return () => registerDialogs(null);
  }, [api]);

  const close = (result) => {
    if (!dialog) return;
    dialog.resolve(result);
    setDialog(null);
    setTimeout(openNext, 0);
  };

  const submit = (e) => {
    e?.preventDefault();
    if (!dialog) return;
    if (dialog.kind === "prompt") {
      const v = value.trim();
      if (dialog.opts.required && !v) {
        setError(dialog.opts.requiredMessage || "Please fill this in.");
        return;
      }
      close(v);
    } else close(true);
  };

  const opts = dialog?.opts || {};
  const danger = opts.tone ? opts.tone === "danger" : dialog?.kind === "confirm" && DANGER_RE.test(dialog?.message || "");
  const title =
    opts.title ||
    (dialog?.kind === "confirm" ? (danger ? "Are you sure?" : "Please confirm") : dialog?.kind === "prompt" ? dialog.message : "Heads up");
  const confirmLabel = opts.confirmLabel || (dialog?.kind === "alert" ? "OK" : dialog?.kind === "prompt" ? "Submit" : danger ? "Yes, continue" : "Confirm");

  return (
    <>
      {children}
      <Modal open={Boolean(dialog)} onClose={() => close(dialog?.kind === "confirm" ? false : dialog?.kind === "prompt" ? null : true)} title={title} size="sm">
        <form onSubmit={submit} className="space-y-6">
          {(dialog?.kind !== "prompt" || opts.title) && dialog?.message && (
            <p className="whitespace-pre-line text-[0.95rem] leading-relaxed text-text-secondary">{dialog.message}</p>
          )}
          {dialog?.kind === "prompt" && (
            <div>
              {opts.multiline !== false ? (
                <textarea
                  autoFocus
                  rows={3}
                  value={value}
                  maxLength={opts.maxLength || 1000}
                  onChange={(e) => { setValue(e.target.value); setError(""); }}
                  placeholder={opts.placeholder || ""}
                  className="w-full resize-none rounded-2xl border border-border-subtle bg-bg-panel-alt px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-violet focus:outline-none focus:ring-2 focus:ring-violet/20"
                />
              ) : (
                <input
                  autoFocus
                  value={value}
                  maxLength={opts.maxLength || 200}
                  onChange={(e) => { setValue(e.target.value); setError(""); }}
                  placeholder={opts.placeholder || ""}
                  className="w-full rounded-full border border-border-subtle bg-bg-panel-alt px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-violet focus:outline-none focus:ring-2 focus:ring-violet/20"
                />
              )}
              {error && <p className="mt-2 text-xs font-medium text-status-danger">{error}</p>}
            </div>
          )}
          <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
            {dialog?.kind !== "alert" && (
              <button
                type="button"
                onClick={() => close(dialog?.kind === "confirm" ? false : null)}
                className="rounded-full border border-border-strong px-5 py-3 text-sm font-medium text-text-primary transition hover:bg-bg-panel-alt"
              >
                {opts.cancelLabel || "Cancel"}
              </button>
            )}
            <button
              type="submit"
              autoFocus={dialog?.kind !== "prompt"}
              className={danger
                ? "rounded-full bg-status-danger px-6 py-3 text-sm font-semibold text-white transition hover:brightness-95"
                : "btn-primary px-6 py-3 text-sm"}
            >
              {confirmLabel}
            </button>
          </div>
        </form>
      </Modal>
      {createPortal(
        <div
          aria-live="polite"
          className="pointer-events-none fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[120] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:bottom-auto sm:right-5 sm:top-5 sm:w-[380px] sm:items-end"
        >
          {toasts.map((t) => <Toast key={t.id} toast={t} onClose={dismiss} />)}
        </div>,
        document.body
      )}
    </>
  );
}
