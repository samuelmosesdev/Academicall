import { useEffect, useState } from "react";
import Modal from "../Modal";
import { Field } from "../ui";
import { PRIORITY_LABEL } from "./orgHelpers";

const blank = { title: "", description: "", assigneeId: "", priority: "normal", dueAt: "" };

/** Create or edit a task. `assignees` is the list of staff the viewer may give work to. */
export default function TaskFormModal({ open, onClose, assignees, initial, onSave }) {
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    setForm(initial
      ? { title: initial.title, description: initial.description || "", assigneeId: initial.assigneeId, priority: initial.priority, dueAt: initial.dueAt ? initial.dueAt.slice(0, 10) : "" }
      : { ...blank, assigneeId: assignees[0]?.id || "" });
  }, [open, initial, assignees]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    if (!form.title.trim() || !form.assigneeId) { setError("Give the task a title and choose who does it."); return; }
    setSaving(true);
    setError("");
    try {
      await onSave({ title: form.title.trim(), description: form.description.trim() || null, assigneeId: form.assigneeId, priority: form.priority, dueAt: form.dueAt || null });
      onClose();
    } catch (err) {
      setError(err?.message || "Could not save the task");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={initial ? "Edit task" : "Assign a task"} open={open} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3.5">
        <Field label="What needs doing?"><input className="acx-input" value={form.title} onChange={set("title")} placeholder="e.g. Review the new CSC 301 past questions" autoFocus /></Field>
        <Field label="Details (optional)"><textarea className="acx-input" rows={3} value={form.description} onChange={set("description")} /></Field>
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Assign to">
            <select className="acx-select w-full" value={form.assigneeId} onChange={set("assigneeId")}>
              {assignees.map((a) => <option key={a.id} value={a.id}>{a.name || a.email}{a.positionTitle ? ` · ${a.positionTitle}` : ""}</option>)}
            </select>
          </Field>
          <Field label="Due"><input type="date" className="acx-input" value={form.dueAt} onChange={set("dueAt")} /></Field>
        </div>
        <Field label="Priority">
          <div className="flex flex-wrap gap-2">
            {Object.entries(PRIORITY_LABEL).map(([value, label]) => (
              <button key={value} type="button" onClick={() => setForm((f) => ({ ...f, priority: value }))}
                className={form.priority === value ? "acx-btn" : "acx-btn-ghost"} style={{ padding: "0.35rem 0.85rem" }}>{label}</button>
            ))}
          </div>
        </Field>
        {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="acx-btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="acx-btn" disabled={saving}>{saving ? "Saving…" : initial ? "Save changes" : "Assign task"}</button>
        </div>
      </form>
    </Modal>
  );
}
