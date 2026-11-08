import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Wand2, Crown } from "lucide-react";
import Modal from "../Modal";
import { Field, EmptyState } from "../ui";
import { orgApi } from "../../lib/api";
import { appConfirm, notify } from "../../lib/dialogs";
import { StaffAvatar } from "./orgUi";
import { KIND_LABEL } from "./orgHelpers";

function OfficeForm({ open, onClose, office, offices, staff, onSaved }) {
  const [form, setForm] = useState({ name: "", code: "", kind: "department", description: "", parentId: "", headId: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!open) return;
    setError("");
    setForm(office
      ? { name: office.name, code: office.code, kind: office.kind, description: office.description || "", parentId: office.parentId || "", headId: office.headId || "" }
      : { name: "", code: "", kind: "department", description: "", parentId: "", headId: "" });
  }, [open, office]);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setSaving(true); setError("");
    const body = { name: form.name.trim(), kind: form.kind, description: form.description.trim() || null, parentId: form.parentId || null, headId: form.headId || null, ...(form.code.trim() ? { code: form.code.trim() } : {}) };
    try {
      if (office) await orgApi.updateOffice(office.id, body); else await orgApi.createOffice(body);
      notify.success(office ? "Office updated" : "Office created");
      onSaved?.(); onClose();
    } catch (err) { setError(err?.message || "Could not save the office"); }
    finally { setSaving(false); }
  }

  return (
    <Modal title={office ? "Edit office" : "New office"} open={open} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3.5">
        <div className="grid gap-3.5 sm:grid-cols-[1fr_7rem]">
          <Field label="Name"><input className="acx-input" value={form.name} onChange={set("name")} autoFocus /></Field>
          <Field label="Code"><input className="acx-input uppercase" value={form.code} onChange={set("code")} maxLength={12} placeholder="Auto" /></Field>
        </div>
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Type">
            <select className="acx-select w-full" value={form.kind} onChange={set("kind")}>
              {Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Sits under">
            <select className="acx-select w-full" value={form.parentId} onChange={set("parentId")}>
              <option value="">Top level</option>
              {offices.filter((o) => o.id !== office?.id).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </Field>
        </div>
        <Field label={form.kind === "directorate" ? "Director" : "Head (HOD)"} hint="The head supervises everyone in this office and the offices beneath it.">
          <select className="acx-select w-full" value={form.headId} onChange={set("headId")}>
            <option value="">Not assigned</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.name || s.email}{s.positionTitle ? ` · ${s.positionTitle}` : ""}</option>)}
          </select>
        </Field>
        <Field label="What this office is responsible for"><textarea className="acx-input" rows={2} value={form.description} onChange={set("description")} /></Field>
        {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="acx-btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="acx-btn" disabled={saving || !form.name.trim()}>{saving ? "Saving…" : "Save office"}</button>
        </div>
      </form>
    </Modal>
  );
}

/** Create, arrange and staff the offices. Sub-offices are shown indented under their parent. */
export default function OfficeManager({ offices, staff, onChanged }) {
  const [editing, setEditing] = useState(undefined); // undefined = closed, null = new
  const [seeding, setSeeding] = useState(false);

  const roots = offices.filter((o) => !o.parentId || !offices.some((p) => p.id === o.parentId));
  const childrenOf = (id) => offices.filter((o) => o.parentId === id);

  async function seed() {
    setSeeding(true);
    try { const r = await orgApi.seedOffices(); notify.success(r.created ? `${r.created} offices created` : "Default offices already exist"); onChanged?.(); }
    catch (err) { notify.error(err?.message || "Could not set up offices"); }
    finally { setSeeding(false); }
  }
  async function remove(o) {
    if (!(await appConfirm(`Delete “${o.name}”? Its staff and sub-offices are kept but left without an office.`))) return;
    try { await orgApi.deleteOffice(o.id); notify.success("Office deleted"); onChanged?.(); }
    catch (err) { notify.error(err?.message || "Could not delete"); }
  }

  const Card = ({ o, depth }) => (
    <div style={{ marginLeft: depth * 20 }} className="space-y-2.5">
      <div className="acx-card !p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-text-primary">{o.name}</h3>
              <span className="acx-chip-sm">{o.code}</span>
              <span className={`acx-chip-sm ${o.kind === "directorate" ? "is-lemon" : o.kind === "unit" ? "is-aqua" : ""}`}>{KIND_LABEL[o.kind]}</span>
            </div>
            {o.description && <p className="mt-1 text-xs text-text-muted">{o.description}</p>}
            <div className="mt-2.5 flex flex-wrap items-center gap-3 text-xs text-text-secondary">
              {o.head ? <span className="inline-flex items-center gap-1.5"><Crown size={13} className="text-accent" /><StaffAvatar person={o.head} size={20} />{o.head.name}</span> : <span className="text-amber-600">No head assigned</span>}
              <span>{o.members.length} staff</span>
              <span>{o._count.tasks} tasks</span>
            </div>
          </div>
          <div className="flex gap-1.5">
            <button type="button" className="acx-icon-btn" aria-label={`Edit ${o.name}`} onClick={() => setEditing(o)}><Pencil size={14} /></button>
            <button type="button" className="acx-icon-btn is-danger" aria-label={`Delete ${o.name}`} onClick={() => remove(o)}><Trash2 size={14} /></button>
          </div>
        </div>
      </div>
      {childrenOf(o.id).map((c) => <Card key={c.id} o={c} depth={1} />)}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-text-secondary">Offices decide who supervises whom: a head supervises their whole office and everything beneath it.</p>
        <div className="flex gap-2">
          <button type="button" className="acx-btn-ghost" onClick={seed} disabled={seeding}><Wand2 size={14} /> {seeding ? "Setting up…" : "Set up default offices"}</button>
          <button type="button" className="acx-btn" onClick={() => setEditing(null)}><Plus size={14} /> New office</button>
        </div>
      </div>
      {offices.length === 0 ? (
        <EmptyState title="No offices yet" description="Start from the suggested directorates and departments, or create your own." action={<button type="button" className="acx-btn" onClick={seed}>Set up default offices</button>} />
      ) : (
        <div className="space-y-3">{roots.map((o) => <Card key={o.id} o={o} depth={0} />)}</div>
      )}
      <OfficeForm open={editing !== undefined} onClose={() => setEditing(undefined)} office={editing || null} offices={offices} staff={staff} onSaved={onChanged} />
    </div>
  );
}
