import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import Modal from "../Modal";
import { Field } from "../ui";


/**
 * A small form-in-a-modal driven by a field list:
 *   fields = [{ name, label, type: "text" | "select" | "number" | "textarea", options, required, placeholder, hint, maxLength }]
 * onSubmit(values) may throw; its message is shown inside the dialog.
 */
export function FormModal({ open, title, fields, initial = {}, submitLabel = "Save", onSubmit, onClose, size = "md", note }) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) { setValues(initial); setErrors({}); setError(""); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function submit(e) {
    e.preventDefault();
    const errs = {};
    for (const f of fields) {
      const v = String(values[f.name] ?? "").trim();
      if (f.required && !v) errs[f.name] = `${f.label} is required`;
      else if (f.minLength && v && v.length < f.minLength) errs[f.name] = `At least ${f.minLength} characters`;
      else if (f.pattern && v && !f.pattern.test(v)) errs[f.name] = f.patternMessage || "Check the format";
      else if (f.type === "number" && v && (Number.isNaN(Number(v)) || Number(v) < (f.min ?? -Infinity) || Number(v) > (f.max ?? Infinity))) errs[f.name] = `Between ${f.min} and ${f.max}`;
    }
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    setError("");
    try {
      const out = {};
      for (const f of fields) {
        const raw = values[f.name];
        if (f.type === "number") out[f.name] = raw === "" || raw == null ? null : Number(raw);
        else if (f.type === "checkbox") out[f.name] = Boolean(raw);
        else out[f.name] = raw === "" ? null : typeof raw === "string" ? raw.trim() : raw ?? null;
      }
      await onSubmit(out);
    } catch (err) {
      setError(err.message || "That didn't save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={busy ? () => {} : onClose} title={title} size={size}>
      <form onSubmit={submit} className="space-y-3" noValidate>
        {note && <p className="rounded-xl bg-bg-panel-alt px-3 py-2 text-xs text-text-secondary">{note}</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          {fields.map((f) => (
            <Field key={f.name} label={`${f.label}${f.required ? "" : " (optional)"}`} error={errors[f.name]} hint={f.hint} className={f.wide !== false && (f.type === "textarea" || f.wide) ? "sm:col-span-2" : ""}>
              {f.type === "select" ? (
                <select className="acx-select w-full" value={values[f.name] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}>
                  <option value="">{f.placeholder || "Choose…"}</option>
                  {f.options.map((o) => (Array.isArray(o) ? <option key={o[0]} value={o[0]}>{o[1]}</option> : <option key={o} value={o}>{o}</option>))}
                </select>
              ) : f.type === "textarea" ? (
                <textarea className="acx-input min-h-[5rem]" value={values[f.name] ?? ""} maxLength={f.maxLength} placeholder={f.placeholder} onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))} />
              ) : (
                <input className="acx-input" type={f.type === "number" ? "number" : "text"} value={values[f.name] ?? ""} maxLength={f.maxLength} placeholder={f.placeholder} onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))} />
              )}
            </Field>
          ))}
        </div>
        {error && <p className="rounded-xl bg-status-danger/10 px-3 py-2 text-sm text-status-danger" role="alert">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="acx-btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="acx-btn" disabled={busy}>{busy && <Loader2 size={14} className="animate-spin" />}{submitLabel}</button>
        </div>
      </form>
    </Modal>
  );
}
