import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { KeyRound, LogOut, ShieldCheck, UserX, UserCheck, Copy } from "lucide-react";
import Modal from "../Modal";
import { Field } from "../ui";
import { orgApi, usersApi } from "../../lib/api";
import { appConfirm, notify } from "../../lib/dialogs";
import { StaffAvatar, RoleChip } from "./orgUi";
import { ORG_ROLE_LABEL } from "./orgHelpers";

/** Everything an admin can change about one staff member: position, office, supervisor, access and account state. */
export default function StaffEditor({ open, onClose, person, positions, offices, staff, onChanged }) {
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [temp, setTemp] = useState("");

  useEffect(() => {
    if (!open || !person) return;
    setError(""); setTemp("");
    setForm({ name: person.name || "", positionTitle: person.positionTitle || "", orgRole: person.orgRole || "officer", officeId: person.officeId || "", supervisorId: person.supervisorId || "", positionKey: "" });
  }, [open, person]);

  if (!person || !form) return null;
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const suspended = person.status === "suspended";

  async function run(label, fn, done) {
    setBusy(label); setError("");
    try { const out = await fn(); done?.(out); onChanged?.(); }
    catch (err) { setError(err?.message || "That didn't work"); }
    finally { setBusy(""); }
  }

  const save = () => run("save", () => orgApi.updateStaff(person.id, {
    name: form.name.trim() || undefined,
    positionTitle: form.positionTitle.trim() || null,
    orgRole: form.orgRole,
    officeId: form.officeId || null,
    supervisorId: form.supervisorId || null,
    ...(form.positionKey ? { positionKey: form.positionKey } : {}),
  }), () => { notify.success("Saved"); onClose(); });

  async function tempPassword() {
    if (!(await appConfirm(`Issue a new temporary password for ${person.name}? They will be signed out everywhere and must choose a new password.`))) return;
    run("temp", () => orgApi.tempPassword(person.id), (r) => setTemp(r.tempPassword));
  }
  async function force() {
    if (!(await appConfirm(`Force ${person.name} to change their password at next sign-in? They are signed out everywhere now.`))) return;
    run("force", () => usersApi.forcePasswordChange(person.id, true), () => notify.success("They must change their password at next sign-in"));
  }
  async function signOut() {
    if (!(await appConfirm(`Sign ${person.name} out of every device?`))) return;
    run("signout", () => usersApi.signOutEverywhere(person.id), () => notify.success("Signed out everywhere"));
  }
  async function toggleSuspend() {
    const next = suspended ? "active" : "suspended";
    if (!(await appConfirm(suspended ? `Reactivate ${person.name}?` : `Suspend ${person.name}? They are signed out and can't use the staff workspace until reactivated.`))) return;
    run("status", () => orgApi.updateStaff(person.id, { status: next }), () => { notify.success(suspended ? "Reactivated" : "Suspended"); onClose(); });
  }

  const others = staff.filter((s) => s.id !== person.id);

  return (
    <Modal title="Staff member" open={open} onClose={onClose} size="lg">
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <StaffAvatar person={person} size={44} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-text-primary">{person.name || person.email}</p>
            <p className="truncate text-xs text-text-muted">{person.email}</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5"><RoleChip orgRole={person.orgRole} />{suspended && <span className="acx-chip-sm is-danger">Suspended</span>}</div>
        </div>

        <section className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Full name"><input className="acx-input" value={form.name} onChange={set("name")} /></Field>
          <Field label="Apply a position" hint="Resets rank, duties and permissions to that position.">
            <select className="acx-select w-full" value={form.positionKey} onChange={(e) => {
              const p = positions.find((x) => x.key === e.target.value);
              setForm((f) => ({ ...f, positionKey: e.target.value, ...(p ? { positionTitle: p.title, orgRole: p.orgRole } : {}) }));
            }}>
              <option value="">Keep as is</option>
              {positions.map((p) => <option key={p.key} value={p.key}>{p.title}</option>)}
            </select>
          </Field>
          <Field label="Job title"><input className="acx-input" value={form.positionTitle} onChange={set("positionTitle")} /></Field>
          <Field label="Level in the office">
            <select className="acx-select w-full" value={form.orgRole} onChange={set("orgRole")}>
              {Object.entries(ORG_ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Office">
            <select className="acx-select w-full" value={form.officeId} onChange={set("officeId")}>
              <option value="">No office</option>
              {offices.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </Field>
          <Field label="Supervised by">
            <select className="acx-select w-full" value={form.supervisorId} onChange={set("supervisorId")}>
              <option value="">Nobody</option>
              {others.map((s) => <option key={s.id} value={s.id}>{s.name || s.email}{s.positionTitle ? ` · ${s.positionTitle}` : ""}</option>)}
            </select>
          </Field>
        </section>

        <section className="rounded-2xl border border-border-subtle p-3.5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Account & access</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="acx-btn-ghost" disabled={!!busy} onClick={tempPassword}><KeyRound size={14} /> Issue temporary password</button>
            <button type="button" className="acx-btn-ghost" disabled={!!busy} onClick={force}><ShieldCheck size={14} /> Force password change</button>
            <button type="button" className="acx-btn-ghost" disabled={!!busy} onClick={signOut}><LogOut size={14} /> Sign out everywhere</button>
            <Link to="/admin/access" className="acx-btn-ghost"><ShieldCheck size={14} /> Edit permissions</Link>
            <button type="button" className={`acx-btn-ghost ${suspended ? "" : "!border-red-400/50 !text-red-500"}`} disabled={!!busy} onClick={toggleSuspend}>
              {suspended ? <><UserCheck size={14} /> Reactivate</> : <><UserX size={14} /> Suspend</>}
            </button>
          </div>
          {temp && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-bg-panel-alt px-3 py-2 font-mono text-sm">
              <span><span className="text-text-muted">New temporary password </span><strong>{temp}</strong></span>
              <button type="button" className="acx-btn-ghost" onClick={() => navigator.clipboard?.writeText(temp).then(() => notify.success("Copied"))}><Copy size={13} /> Copy</button>
            </div>
          )}
        </section>

        {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="acx-btn-ghost" onClick={onClose}>Close</button>
          <button type="button" className="acx-btn" disabled={!!busy} onClick={save}>{busy === "save" ? "Saving…" : "Save changes"}</button>
        </div>
      </div>
    </Modal>
  );
}
