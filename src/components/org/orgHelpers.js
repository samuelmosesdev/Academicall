/** Labels and helpers for the organisation screens. */

export const STATUS_LABEL = { todo: "To do", in_progress: "In progress", blocked: "Blocked", done: "Done" };
export const PRIORITY_LABEL = { low: "Low", normal: "Normal", high: "High", urgent: "Urgent" };
export const ORG_ROLE_LABEL = { director: "Director", hod: "HOD", supervisor: "Supervisor", officer: "Officer" };
export const KIND_LABEL = { directorate: "Directorate", department: "Department", unit: "Unit" };

export const initialsOf = (name = "") =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "?";

export const isOverdue = (task) => !!task.dueAt && task.status !== "done" && new Date(task.dueAt) < new Date();

export function fmtDue(value) {
  if (!value) return "No due date";
  return new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
