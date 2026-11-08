import { useEffect, useState } from "react";
import { Copy, Check, KeyRound } from "lucide-react";
import Modal from "../Modal";
import { Field } from "../ui";
import { orgApi } from "../../lib/api";
import { notify } from "../../lib/dialogs";
import { ORG_ROLE_LABEL } from "./orgHelpers";

const blank = { name: "", email: "", positionKey: "", positionTitle: "", orgRole: "officer", officeId: "", supervisorId: "", password: "" };

/**
 * Create a staff account: pick the position (it sets rank, permissions and duties), the office and
 * who supervises them. The person is forced to choose their own password at first sign-in.
 */
export default function CreateStaffModal({ open, onClose, positions, offices, staff, onCreated }) {
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) { setForm(blank); setError(""); setCreated(null); setCopied(false); }
  }, [open]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const position = positions.find((p) => p.key === form.positionKey);

  function pick(p) {
    setForm((f) => ({ ...f, positionKey: p.key, positionTitle: p.title, orgRole: p.orgRole }));
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!form.name.trim() || !form.email.trim()) { setError("Enter the person's name and email."); return; }
    setSaving(true);
    try {
      const result = await orgApi.createStaff({
        name: form.name.trim(), email: form.email.trim(),
        positionKey: form.positionKey || undefined, positionTitle: form.positionTitle.trim() || null,
        orgRole: form.orgRole, officeId: form.officeId || null, supervisorId: form.supervisorId || null,
        ...(form.password ? { password: form.password } : {}),
      });
      setCreated({ ...result, password: result.tempPassword });
      onCreated?.();
    } catch (err) {
      setError(err?.message || "Could not create the account");
    } finally {
      setSaving(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(`Email: ${created.user.email}\nTemporary password: ${created.password}`);
      setCopied(true);
      notify.success("Sign-in details copied");
    } catch {
      notify.error("Couldn't copy. Select the password and copy it by hand.");
    }
  }

  if (created) {
    return (
      <Modal title="Account created" open={open} onClose={onClose}>
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            <strong className="text-text-primary">{created.user.name}</strong> can sign in now and will be asked to choose a new password straight away.
            Share these details privately. The password is shown only once.
          </p>
          <div className="rounded-2xl border border-border-subtle bg-bg-panel-alt p-4 font-mono text-sm">
            <p><span className="text-text-muted">Email </span>{created.user.email}</p>
            <p className="mt-1"><span className="text-text-muted">Temporary password </span><strong>{created.password}</strong></p>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="acx-btn-ghost" onClick={copy}>{copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy details"}</button>
            <button type="button" className="acx-btn" onClick={onClose}>Done</button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Add a staff member" open={open} onClose={onClose} size="lg">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Full name"><input className="acx-input" value={form.name} onChange={set("name")} autoFocus /></Field>
          <Field label="Work email"><input type="email" className="acx-input" value={form.email} onChange={set("email")} placeholder="name@academicall.site" /></Field>
        </div>

        <div>
          <span className="acx-label">Position</span>
          <div className="grid max-h-56 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
            {positions.map((p) => (
              <button key={p.key} type="button" onClick={() => pick(p)}
                className={`rounded-xl border px-3 py-2 text-left transition ${form.positionKey === p.key ? "border-accent bg-accent-soft" : "border-border-subtle hover:bg-bg-panel-alt"}`}>
                <span className="block text-sm font-semibold text-text-primary">{p.title}</span>
                <span className="block text-[0.72rem] leading-snug text-text-muted">{p.blurb}</span>
              </button>
            ))}
          </div>
          {position && <p className="mt-1.5 text-xs text-text-muted">Gets: {position.duties.join(" · ")}. Fine-tune permissions later in Staff access.</p>}
        </div>

        <div className="grid gap-3.5 sm:grid-cols-3">
          <Field label="Job title"><input className="acx-input" value={form.positionTitle} onChange={set("positionTitle")} placeholder="Shown on their dashboard" /></Field>
          <Field label="Level in the office">
            <select className="acx-select w-full" value={form.orgRole} onChange={set("orgRole")}>
              {Object.entries(ORG_ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Office">
            <select className="acx-select w-full" value={form.officeId} onChange={set("officeId")}>
              <option value="">No office yet</option>
              {offices.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Reports to (supervisor)" hint="Heads of an office automatically supervise the people in it.">
            <select className="acx-select w-full" value={form.supervisorId} onChange={set("supervisorId")}>
              <option value="">Nobody</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.name || s.email}{s.positionTitle ? ` · ${s.positionTitle}` : ""}</option>)}
            </select>
          </Field>
          <Field label="Temporary password" hint="Leave blank to generate a strong one.">
            <input className="acx-input" value={form.password} onChange={set("password")} placeholder="Auto-generate" autoComplete="off" />
          </Field>
        </div>
        <p className="flex items-center gap-2 rounded-xl bg-bg-panel-alt px-3 py-2 text-xs text-text-secondary"><KeyRound size={14} className="text-accent" />They must change this password the first time they sign in.</p>
        {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="acx-btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="acx-btn" disabled={saving}>{saving ? "Creating…" : "Create account"}</button>
        </div>
      </form>
    </Modal>
  );
}
