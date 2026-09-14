import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { activityApi } from "../lib/api";

export default function AdminActivity() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    activityApi.list("limit=100").then((response) => {
      setActivities(response.activities || response.activity || response || []);
    }).catch(() => setActivities([])).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-5">
      <div><h1 className="text-lg font-semibold text-text-primary">Activity</h1><p className="text-sm text-text-muted">Platform-wide timeline. Open a user for detailed filters and undo.</p></div>
      {loading && <p className="text-sm text-text-muted">Loading…</p>}
      <div className="divide-y divide-border-subtle overflow-hidden rounded-xl border border-border-subtle bg-bg-panel">
        {activities.map((item) => <div key={item.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 text-sm"><div><div className="font-medium text-text-primary">{item.action}</div><div className="text-xs text-text-muted">{item.actorName || "System"}{item.targetName ? ` → ${item.targetName}` : ""}</div></div><div className="flex items-center gap-3 text-xs text-text-muted">{item.createdAt ? new Date(item.createdAt).toLocaleString() : "—"}{item.targetUid && <Link to={`/admin/users/${item.targetUid}/activity`} className="text-accent hover:underline">User log</Link>}</div></div>)}
        {!loading && activities.length === 0 && <p className="px-4 py-10 text-center text-sm text-text-muted">No activity recorded yet.</p>}
      </div>
    </div>
  );
}
