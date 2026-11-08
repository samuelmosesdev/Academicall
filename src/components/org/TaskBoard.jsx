import { useState } from "react";
import { Clock, MessageSquare, Pencil, Trash2, Building2 } from "lucide-react";
import { PriorityChip, StaffAvatar } from "./orgUi";
import { STATUS_LABEL, fmtDue, isOverdue } from "./orgHelpers";

const COLUMNS = ["todo", "in_progress", "blocked", "done"];
const NEXT = { todo: ["in_progress"], in_progress: ["blocked", "done"], blocked: ["in_progress"], done: ["todo"] };
const NEXT_LABEL = { in_progress: "Start", blocked: "Blocked", done: "Mark done", todo: "Reopen" };

function TaskCard({ task, meId, showAssignee, onUpdate, onEdit, onDelete }) {
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState(task.note || "");
  const mine = task.assigneeId === meId;
  const late = isOverdue(task);
  return (
    <article className={`rounded-2xl border bg-bg-panel p-3.5 ${late ? "border-red-400/50" : "border-border-subtle"}`}>
      <div className="flex items-start justify-between gap-2">
        <h4 className={`text-sm font-semibold leading-snug ${task.status === "done" ? "text-text-muted line-through" : "text-text-primary"}`}>{task.title}</h4>
        <PriorityChip priority={task.priority} />
      </div>
      {task.description && <p className="mt-1 line-clamp-2 text-xs text-text-secondary">{task.description}</p>}
      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.72rem] text-text-muted">
        <span className={`inline-flex items-center gap-1 ${late ? "font-semibold text-red-500" : ""}`}><Clock size={12} />{late ? "Overdue · " : ""}{fmtDue(task.dueAt)}</span>
        {task.office && <span className="inline-flex items-center gap-1"><Building2 size={12} />{task.office.code}</span>}
        {showAssignee && task.assignee && (
          <span className="inline-flex items-center gap-1.5"><StaffAvatar person={task.assignee} size={18} />{task.assignee.nickname || task.assignee.name}</span>
        )}
      </div>
      {task.note && !noteOpen && <p className="mt-2 rounded-lg bg-bg-panel-alt px-2.5 py-1.5 text-xs text-text-secondary">“{task.note}”</p>}
      {noteOpen && (
        <div className="mt-2 space-y-1.5">
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Progress note" className="acx-input" />
          <div className="flex gap-2">
            <button type="button" className="acx-btn" onClick={() => { onUpdate(task.id, { note }); setNoteOpen(false); }}>Save note</button>
            <button type="button" className="acx-btn-ghost" onClick={() => setNoteOpen(false)}>Cancel</button>
          </div>
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {NEXT[task.status].map((next) => (
          <button key={next} type="button" onClick={() => onUpdate(task.id, { status: next })} className={next === "done" ? "acx-btn" : "acx-btn-ghost"} style={{ padding: "0.3rem 0.7rem", fontSize: "0.72rem" }}>
            {NEXT_LABEL[next]}
          </button>
        ))}
        {(mine || onEdit) && (
          <button type="button" aria-label="Add a note" title="Add a note" className="acx-icon-btn" onClick={() => setNoteOpen((v) => !v)}><MessageSquare size={14} /></button>
        )}
        {onEdit && <button type="button" aria-label="Edit task" title="Edit" className="acx-icon-btn" onClick={() => onEdit(task)}><Pencil size={14} /></button>}
        {onDelete && <button type="button" aria-label="Delete task" title="Delete" className="acx-icon-btn is-danger" onClick={() => onDelete(task)}><Trash2 size={14} /></button>}
      </div>
    </article>
  );
}

/**
 * Tasks grouped by status. Whoever the task is assigned to can move it along and add
 * a note; `onEdit` / `onDelete` are only passed when the viewer manages the task.
 */
export default function TaskBoard({ tasks, meId, showAssignee = false, onUpdate, onEdit, onDelete, hideDone = false }) {
  const columns = hideDone ? COLUMNS.filter((c) => c !== "done") : COLUMNS;
  return (
    <div className={`grid grid-cols-1 gap-4 md:grid-cols-2 ${columns.length === 4 ? "xl:grid-cols-4" : "xl:grid-cols-3"}`}>
      {columns.map((status) => {
        const items = tasks.filter((t) => t.status === status);
        return (
          <section key={status} aria-label={STATUS_LABEL[status]} className="min-w-0 rounded-2xl bg-bg-panel-alt/60 p-2.5">
            <h3 className="mb-2 flex items-center justify-between px-1.5 text-xs font-semibold uppercase tracking-wide text-text-secondary">
              {STATUS_LABEL[status]}
              <span className="num rounded-full bg-bg-panel px-2 py-0.5 text-[0.7rem] text-text-muted">{items.length}</span>
            </h3>
            <div className="space-y-2.5">
              {items.length === 0 && <p className="rounded-xl border border-dashed border-border-subtle px-3 py-5 text-center text-xs text-text-muted">Nothing here</p>}
              {items.map((task) => (
                <TaskCard key={task.id} task={task} meId={meId} showAssignee={showAssignee} onUpdate={onUpdate}
                  onEdit={onEdit && (task.canManage !== false ? onEdit : undefined)} onDelete={onDelete} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
