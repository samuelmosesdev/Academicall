import { useEffect, useState } from "react";
import { activityApi } from "../lib/api";

export default function AdminAuditLog() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    activityApi.list("limit=200").then((response) => {
      const activities = response.activities || response.activity || response || [];
      setRows(activities.filter((item) => /role|suspend|password|revert|delete|agent|login/i.test(item.action || "")));
    }).catch(() => setRows([])).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-5">
      <div><h1 className="text-lg font-semibold text-text-primary">Audit Log</h1><p className="text-sm text-text-muted">Security-sensitive and governance events only.</p></div>
      {loading && <p className="text-sm text-text-muted">Loading…</p>}
      <div className="overflow-x-auto rounded-xl border border-border-subtle"><table className="w-full min-w-[640px] text-left text-sm"><thead className="bg-bg-elevated text-xs uppercase text-text-muted"><tr><th className="px-3 py-2">When</th><th className="px-3 py-2">Action</th><th className="px-3 py-2">Actor</th><th className="px-3 py-2">Target</th><th className="px-3 py-2">Ref</th></tr></thead><tbody className="divide-y divide-border-subtle bg-bg-panel">{rows.map((item) => <tr key={item.id}><td className="whitespace-nowrap px-3 py-2 text-xs text-text-muted">{item.createdAt ? new Date(item.createdAt).toLocaleString() : "—"}</td><td className="px-3 py-2 font-medium text-text-primary">{item.action}{item.reversed && <span className="ml-1 text-xs text-red-400">reversed</span>}</td><td className="px-3 py-2 text-text-muted">{item.actorName || "—"}</td><td className="px-3 py-2 text-text-muted">{item.targetName || "—"}</td><td className="px-3 py-2 font-mono text-[10px] text-text-muted">{item.reference || item.id?.slice(0, 8)}</td></tr>)}</tbody></table>{!loading && rows.length === 0 && <p className="px-4 py-8 text-center text-sm text-text-muted">No audit events yet.</p>}</div>
    </div>
  );
}
