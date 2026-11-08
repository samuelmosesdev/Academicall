import { Crown } from "lucide-react";
import { EmptyState } from "../ui";
import { RoleChip, StaffAvatar } from "./orgUi";
import { KIND_LABEL } from "./orgHelpers";

/** The organisation at a glance: offices nested under their parent, each with its head and staff. */
export default function OrgChart({ offices, staff }) {
  const unplaced = staff.filter((s) => !s.officeId);
  if (offices.length === 0 && staff.length === 0) return <EmptyState title="Nothing to chart yet" description="Create offices and staff accounts and the structure appears here." />;
  const roots = offices.filter((o) => !o.parentId || !offices.some((p) => p.id === o.parentId));
  const kids = (id) => offices.filter((o) => o.parentId === id);

  const Node = ({ o, depth }) => (
    <li className="space-y-2">
      <div className={`rounded-2xl border p-3.5 ${depth === 0 ? "border-accent/40 bg-accent-soft/50" : "border-border-subtle bg-bg-panel"}`}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-text-primary">{o.name}</span>
          <span className="acx-chip-sm">{KIND_LABEL[o.kind]}</span>
        </div>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {o.head && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-lemon px-2.5 py-1 text-xs font-semibold text-midnight"><Crown size={12} />{o.head.name}</span>
          )}
          {o.members.filter((m) => m.id !== o.head?.id).map((m) => (
            <span key={m.id} title={m.positionTitle || ""} className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-bg-panel px-2 py-1 text-xs text-text-secondary">
              <StaffAvatar person={m} size={18} />{m.nickname || m.name}
            </span>
          ))}
          {!o.head && o.members.length === 0 && <span className="text-xs text-text-muted">Empty</span>}
        </div>
      </div>
      {kids(o.id).length > 0 && (
        <ul className="ml-4 space-y-2 border-l-2 border-border-subtle pl-4">{kids(o.id).map((c) => <Node key={c.id} o={c} depth={depth + 1} />)}</ul>
      )}
    </li>
  );

  return (
    <div className="space-y-5">
      <ul className="space-y-3">{roots.map((o) => <Node key={o.id} o={o} depth={0} />)}</ul>
      {unplaced.length > 0 && (
        <div className="rounded-2xl border border-dashed border-border-strong p-4">
          <p className="mb-2 text-sm font-semibold text-text-primary">Not in an office yet ({unplaced.length})</p>
          <div className="flex flex-wrap gap-2">
            {unplaced.map((s) => (
              <span key={s.id} className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-bg-panel px-2.5 py-1 text-xs text-text-secondary"><StaffAvatar person={s} size={18} />{s.name} <RoleChip orgRole={s.orgRole} /></span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
