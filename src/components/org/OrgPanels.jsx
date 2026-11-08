import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, Check, ChevronRight, Network, Target, UserRound, Users } from "lucide-react";
import { orgApi } from "../../lib/api";
import { useQuietPoll } from "../../hooks/useQuietPoll";
import { useStaffShell } from "../staff/StaffShellContext";
import { PriorityChip, RoleChip, StaffAvatar, StatTile } from "./orgUi";
import { fmtDue, isOverdue } from "./orgHelpers";
import { notify } from "../../lib/dialogs";

/** The next few open tasks, with a one-tap "done". Refreshes quietly. */
export function MyTasksPanel() {
  const [tasks, setTasks] = useState(null);
  const load = useCallback(async () => {
    try { const r = await orgApi.tasks("mine"); setTasks((cur) => (JSON.stringify(cur) === JSON.stringify(r.tasks) ? cur : r.tasks || [])); }
    catch (error) { console.error("Failed to load staff tasks", error); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useQuietPoll(load, { interval: 60_000 });

  const open = (tasks || []).filter((t) => t.status !== "done");
  async function done(task) {
    setTasks((cur) => cur.map((t) => (t.id === task.id ? { ...t, status: "done" } : t))); // instant, then confirm with the server
    try {
      await orgApi.updateTask(task.id, { status: "done" });
    } catch (error) {
      console.error("Failed to mark staff task done", error);
      notify.error(error?.message || "Could not update the task");
    } finally {
      await load();
    }
  }

  return (
    <section aria-label="My tasks" className="acx-card !p-0">
      <div className="flex items-center justify-between border-b border-border-subtle px-5 py-3.5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-text-primary"><Target size={15} className="text-accent" /> My tasks {open.length > 0 && <span className="num rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent">{open.length}</span>}</h2>
        <Link to="/agent/my-work" className="text-xs font-medium text-accent hover:underline">Open my work →</Link>
      </div>
      {tasks === null ? <div className="h-28 animate-pulse" aria-hidden="true" /> : open.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-text-muted">Nothing assigned right now. You're all clear.</p>
      ) : (
        <ul className="divide-y divide-border-subtle">
          {open.slice(0, 5).map((t) => (
            <li key={t.id} className="flex items-center gap-3 px-5 py-3">
              <button type="button" onClick={() => done(t)} aria-label={`Mark “${t.title}” done`} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border-strong text-transparent transition hover:border-accent hover:bg-accent-soft hover:text-accent"><Check size={14} /></button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-text-primary">{t.title}</p>
                <p className={`text-xs ${isOverdue(t) ? "font-semibold text-red-500" : "text-text-muted"}`}>{isOverdue(t) ? "Overdue · " : ""}{fmtDue(t.dueAt)}{t.createdBy ? ` · from ${t.createdBy.nickname || t.createdBy.name}` : ""}</p>
              </div>
              <PriorityChip priority={t.priority} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Where this person sits: office, level, who they report to, and what they're responsible for. */
export function MyOfficePanel() {
  const { org } = useStaffShell();
  if (!org) return <div className="h-40 animate-pulse rounded-2xl border border-border-subtle bg-bg-panel" aria-hidden="true" />;
  const boss = org.supervisor || (org.office?.head && org.orgRole !== "director" && org.orgRole !== "hod" ? org.office.head : null);
  return (
    <section aria-label="My office" className="acx-card space-y-3 !p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-text-primary"><Building2 size={15} className="text-accent" />{org.office?.name || "No office assigned yet"}</p>
          <p className="mt-0.5 text-xs text-text-muted">{org.positionTitle || "Staff"}</p>
        </div>
        <RoleChip orgRole={org.orgRole} />
      </div>
      {boss && <div className="flex items-center gap-2 text-xs text-text-secondary"><UserRound size={13} className="text-text-muted" />Reports to <StaffAvatar person={boss} size={20} /><span className="font-medium text-text-primary">{boss.name}</span></div>}
      {org.headOf?.length > 0 && <p className="text-xs text-text-secondary">You head: <span className="font-medium text-text-primary">{org.headOf.map((o) => o.name).join(", ")}</span></p>}
      {org.duties?.length > 0 && (
        <ul className="space-y-1 border-t border-border-subtle pt-3">
          {org.duties.slice(0, 4).map((d) => <li key={d} className="flex gap-2 text-xs text-text-secondary"><ChevronRight size={12} className="mt-0.5 shrink-0 text-accent" />{d}</li>)}
        </ul>
      )}
    </section>
  );
}

/** Supervisors only: who is on the team and who's carrying the most. */
export function TeamPanel() {
  const { org } = useStaffShell();
  if (!org?.isSupervisor) return null;
  const team = org.team || [];
  const late = team.reduce((n, m) => n + m.overdueTasks, 0);
  return (
    <section aria-label="My team" className="acx-card !p-0">
      <div className="flex items-center justify-between border-b border-border-subtle px-5 py-3.5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-text-primary"><Users size={15} className="text-accent" /> My team <span className="num rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent">{team.length}</span>
          {late > 0 && <span className="acx-chip-sm is-danger">{late} overdue</span>}</h2>
        <Link to="/agent/my-team" className="text-xs font-medium text-accent hover:underline">Manage team →</Link>
      </div>
      <ul className="grid sm:grid-cols-2 xl:grid-cols-3">
        {team.slice(0, 6).map((m) => (
          <li key={m.id} className="flex items-center gap-3 border-t border-border-subtle px-5 py-3">
            <StaffAvatar person={m} size={32} />
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-text-primary">{m.name}</p><p className="truncate text-xs text-text-muted">{m.positionTitle || "Staff"}</p></div>
            <span className="text-right text-xs text-text-secondary"><span className="num text-sm text-text-primary">{m.openTasks}</span> open{m.overdueTasks > 0 && <span className="block font-semibold text-red-500">{m.overdueTasks} late</span>}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Admin dashboard: the organisation in one strip. */
export function OrgPulse({ overview }) {
  if (!overview) return null;
  const { staff, tasks, offices } = overview;
  return (
    <section aria-label="Organization" className="acx-card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-text-primary"><Network size={15} className="text-accent" /> Organization</h2>
        <Link to="/admin/organization" className="text-xs font-medium text-accent hover:underline">Manage →</Link>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Staff" value={staff.total} />
        <StatTile label="Offices" value={offices} />
        <StatTile label="Open tasks" value={tasks.open} />
        <StatTile label="Overdue" value={tasks.overdue} tone={tasks.overdue ? "bad" : ""} />
      </div>
    </section>
  );
}
