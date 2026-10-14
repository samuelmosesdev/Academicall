import { Link } from "react-router-dom";
import { ShieldCheck, Newspaper, Feather, ArrowRight } from "lucide-react";
import { useAccessCatalog } from "./AccessEditor";
import { ROLE_LABELS, hasTag } from "../../lib/roles";

const SHORTCUTS = [
  { cap: "users.view", to: "/agent/users", label: "Users" },
  { cap: "documents.review", to: "/agent/documents", label: "Review materials" },
  { cap: "files.center", to: "/agent/files", label: "Document Center" },
  { cap: "requests.review", to: "/agent/requests", label: "Requests" },
  { cap: "payments.review", to: "/agent/payments", label: "Payments" },
  { cap: "activity.view", to: "/agent/activity-log", label: "Activity log" },
];

/** "What I can do" for an agent: role, duties, and the permissions an admin gave them. */
export default function MyAccessCard({ profile }) {
  const catalog = useAccessCatalog();
  const caps = profile?.capabilities || [];
  const labels = (catalog?.capabilities || []).filter((c) => caps.includes(c.key));
  const shortcuts = SHORTCUTS.filter((s) => caps.includes(s.cap));
  return (
    <section className="acx-card">
      <header className="acx-card-head">
        <div>
          <h3 className="flex items-center gap-2"><ShieldCheck size={16} className="text-accent" /> Your access</h3>
          <p>{ROLE_LABELS[profile?.role] || "Staff"} · {profile?.customPermissions ? "set by an admin" : "role defaults"} · {caps.length} permission{caps.length === 1 ? "" : "s"}</p>
        </div>
        <div className="flex gap-1.5">
          {hasTag(profile, "news") && <Link to="/news/desk" className="acx-chip-sm is-aqua"><Newspaper size={11} /> News desk</Link>}
          {hasTag(profile, "secretary") && <Link to="/secretariat" className="acx-chip-sm is-lemon"><Feather size={11} /> Secretariat</Link>}
        </div>
      </header>
      <div className="flex flex-wrap gap-1.5">
        {labels.map((c) => <span key={c.key} className="acx-chip-sm" title={c.hint}>{c.label}</span>)}
        {labels.length === 0 && <span className="text-xs text-text-muted">No permissions yet. Ask an admin.</span>}
      </div>
      {shortcuts.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {shortcuts.map((s) => <Link key={s.to} to={s.to} className="acx-btn-ghost">{s.label} <ArrowRight size={13} /></Link>)}
        </div>
      )}
    </section>
  );
}
