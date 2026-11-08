import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { StatTile } from "./orgUi";
import { KIND_LABEL } from "./orgHelpers";

/** Admin snapshot of the organisation, with the things that need fixing called out. */
export default function OrgOverview({ overview, onGo }) {
  if (!overview) return null;
  const { staff, tasks, byOffice } = overview;
  const issues = [
    staff.noOffice > 0 && { text: `${staff.noOffice} staff have no office`, tab: "staff" },
    staff.unsupervised > 0 && { text: `${staff.unsupervised} staff have no supervisor`, tab: "staff" },
    staff.pendingFirstLogin > 0 && { text: `${staff.pendingFirstLogin} haven't signed in and set a password yet`, tab: "staff" },
    tasks.overdue > 0 && { text: `${tasks.overdue} tasks are overdue`, to: "/admin/tasks" },
    byOffice.some((o) => !o.head) && { text: `${byOffice.filter((o) => !o.head).length} offices have no head`, tab: "offices" },
  ].filter(Boolean);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile label="Staff" value={staff.total} hint={staff.suspended ? `${staff.suspended} suspended` : undefined} />
        <StatTile label="Offices" value={overview.offices} />
        <StatTile label="Open tasks" value={tasks.open} />
        <StatTile label="Overdue" value={tasks.overdue} tone={tasks.overdue ? "bad" : ""} />
        <StatTile label="Done this week" value={tasks.doneThisWeek} />
      </div>

      {issues.length > 0 && (
        <div className="rounded-2xl border border-amber-400/50 bg-amber-400/10 p-4">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-text-primary"><AlertTriangle size={15} className="text-amber-500" /> Needs tidying</p>
          <ul className="space-y-1.5">
            {issues.map((i) => (
              <li key={i.text} className="flex items-center justify-between gap-3 text-sm text-text-secondary">
                {i.text}
                {i.to ? <Link to={i.to} className="inline-flex items-center gap-1 text-xs font-semibold text-accent">View <ArrowRight size={12} /></Link>
                  : <button type="button" onClick={() => onGo(i.tab)} className="inline-flex items-center gap-1 text-xs font-semibold text-accent">Fix <ArrowRight size={12} /></button>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-border-subtle bg-bg-panel">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-text-muted">
            <tr className="border-b border-border-subtle"><th className="px-4 py-3">Office</th><th className="px-4 py-3">Head</th><th className="px-4 py-3">Staff</th><th className="px-4 py-3">Open tasks</th></tr>
          </thead>
          <tbody>
            {byOffice.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-text-muted">No offices yet. Create them in the Offices tab.</td></tr>}
            {byOffice.map((o) => (
              <tr key={o.id} className="border-b border-border-subtle last:border-0">
                <td className="px-4 py-2.5"><span className="font-medium text-text-primary">{o.name}</span> <span className="acx-chip-sm ml-1">{KIND_LABEL[o.kind]}</span></td>
                <td className="px-4 py-2.5 text-text-secondary">{o.head?.name || <span className="text-amber-600">None</span>}</td>
                <td className="num px-4 py-2.5">{o.staff}</td>
                <td className="num px-4 py-2.5">{o.openTasks}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
