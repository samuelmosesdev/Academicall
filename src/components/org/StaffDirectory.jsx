import { useMemo, useState } from "react";
import { UserPlus, Download, Network } from "lucide-react";
import { SearchField, EmptyState } from "../ui";
import { orgApi } from "../../lib/api";
import { notify } from "../../lib/dialogs";
import { RoleChip, StaffAvatar } from "./orgUi";

const ago = (v) => {
  if (!v) return "Never";
  const d = Math.floor((Date.now() - new Date(v)) / 864e5);
  return d <= 0 ? "Today" : d === 1 ? "Yesterday" : `${d}d ago`;
};

/** Every staff account with its office, supervisor and workload; select several to give them a supervisor in one go. */
export default function StaffDirectory({ staff, offices, onOpen, onAdd, onChanged }) {
  const [q, setQ] = useState("");
  const [office, setOffice] = useState("");
  const [filter, setFilter] = useState("all");
  const [picked, setPicked] = useState([]);
  const [bulkSup, setBulkSup] = useState("");

  const byId = useMemo(() => new Map(staff.map((s) => [s.id, s])), [staff]);
  const officeName = useMemo(() => new Map(offices.map((o) => [o.id, o.name])), [offices]);

  const rows = useMemo(() => staff.filter((s) => {
    const text = `${s.name || ""} ${s.email} ${s.positionTitle || ""}`.toLowerCase();
    if (q && !text.includes(q.toLowerCase())) return false;
    if (office === "none" ? s.officeId : office && s.officeId !== office) return false;
    if (filter === "unsupervised") return !s.supervisorId && s.orgRole !== "director";
    if (filter === "pending") return s.mustChangePassword;
    if (filter === "suspended") return s.status === "suspended";
    if (filter === "late") return s.overdueTasks > 0;
    return true;
  }), [staff, q, office, filter]);

  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  async function applyBulk() {
    try {
      await orgApi.assignSupervision({ staffIds: picked, supervisorId: bulkSup || null });
      notify.success(`Supervision updated for ${picked.length} staff`);
      setPicked([]); setBulkSup(""); onChanged?.();
    } catch (err) { notify.error(err?.message || "Could not update supervision"); }
  }

  function exportCsv() {
    const head = ["Name", "Email", "Position", "Level", "Office", "Supervisor", "Status", "Open tasks", "Overdue"];
    const lines = staff.map((s) => [s.name, s.email, s.positionTitle, s.orgRole, officeName.get(s.officeId), byId.get(s.supervisorId)?.name, s.status, s.openTasks, s.overdueTasks]
      .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","));
    const url = URL.createObjectURL(new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "academicall-staff.csv" });
    a.click(); URL.revokeObjectURL(url);
  }

  const filters = [["all", "All"], ["unsupervised", "No supervisor"], ["pending", "Not signed in yet"], ["late", "Overdue work"], ["suspended", "Suspended"]];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <SearchField value={q} onChange={setQ} placeholder="Search name, email or position" className="w-full sm:w-72" />
        <select className="acx-select" value={office} onChange={(e) => setOffice(e.target.value)} aria-label="Office">
          <option value="">All offices</option>
          <option value="none">No office</option>
          {offices.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <div className="ml-auto flex gap-2">
          <button type="button" className="acx-btn-ghost" onClick={exportCsv}><Download size={14} /> Export</button>
          <button type="button" className="acx-btn" onClick={onAdd}><UserPlus size={14} /> Add staff</button>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {filters.map(([key, label]) => (
          <button key={key} type="button" onClick={() => setFilter(key)} className={filter === key ? "acx-btn" : "acx-btn-ghost"} style={{ padding: "0.3rem 0.8rem", fontSize: "0.75rem" }}>{label}</button>
        ))}
      </div>

      {picked.length > 0 && (
        <div className="flex flex-wrap items-center gap-2.5 rounded-2xl border border-accent/40 bg-accent-soft px-4 py-3">
          <Network size={16} className="text-accent" />
          <span className="text-sm font-medium text-text-primary">{picked.length} selected · supervised by</span>
          <select className="acx-select" value={bulkSup} onChange={(e) => setBulkSup(e.target.value)}>
            <option value="">Nobody (clear)</option>
            {staff.filter((s) => !picked.includes(s.id)).map((s) => <option key={s.id} value={s.id}>{s.name || s.email}</option>)}
          </select>
          <button type="button" className="acx-btn" onClick={applyBulk}>Apply</button>
          <button type="button" className="acx-btn-ghost" onClick={() => setPicked([])}>Clear</button>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState title="No staff match" description="Try another filter, or add a staff member." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border-subtle bg-bg-panel">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-text-muted">
              <tr className="border-b border-border-subtle">
                <th className="w-10 px-3 py-3"><input type="checkbox" aria-label="Select all" checked={picked.length === rows.length} onChange={(e) => setPicked(e.target.checked ? rows.map((r) => r.id) : [])} /></th>
                <th className="px-3 py-3">Staff</th><th className="px-3 py-3">Position</th><th className="px-3 py-3">Office</th>
                <th className="px-3 py-3">Supervisor</th><th className="px-3 py-3">Work</th><th className="px-3 py-3">Last seen</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className="border-b border-border-subtle last:border-0 hover:bg-bg-panel-alt/50">
                  <td className="px-3 py-2.5"><input type="checkbox" aria-label={`Select ${s.name}`} checked={picked.includes(s.id)} onChange={() => toggle(s.id)} /></td>
                  <td className="px-3 py-2.5">
                    <button type="button" onClick={() => onOpen(s)} className="flex items-center gap-2.5 text-left">
                      <StaffAvatar person={s} size={34} />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-text-primary">{s.name || s.email}</span>
                        <span className="block truncate text-xs text-text-muted">{s.email}</span>
                      </span>
                    </button>
                  </td>
                  <td className="px-3 py-2.5"><span className="block text-text-primary">{s.positionTitle || "—"}</span><RoleChip orgRole={s.orgRole} /></td>
                  <td className="px-3 py-2.5 text-text-secondary">{officeName.get(s.officeId) || <span className="text-text-muted">None</span>}</td>
                  <td className="px-3 py-2.5 text-text-secondary">{byId.get(s.supervisorId)?.name || <span className="text-text-muted">—</span>}</td>
                  <td className="px-3 py-2.5">
                    <span className="num text-text-primary">{s.openTasks}</span> <span className="text-xs text-text-muted">open</span>
                    {s.overdueTasks > 0 && <span className="acx-chip-sm is-danger ml-1.5">{s.overdueTasks} late</span>}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-text-muted">
                    {s.status === "suspended" ? <span className="acx-chip-sm is-danger">Suspended</span> : s.mustChangePassword ? <span className="acx-chip-sm is-lemon">Not signed in yet</span> : ago(s.lastActiveAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
