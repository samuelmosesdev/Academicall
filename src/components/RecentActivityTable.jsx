import { UserPlus, UserCog2, ClipboardPlus, Megaphone } from "lucide-react";

const STATUS_STYLES = {
  success: "bg-accent-soft text-accent",
  pending: "bg-status-warning/15 text-status-warning",
  failed: "bg-status-danger/15 text-status-danger",
};

function formatTimestamp(ts) {
  const date = ts?.toDate ? ts.toDate() : ts ? new Date(ts) : null;
  if (!date) return "--";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function RecentActivityTable({ activity, onAddUser, onAddAgent, onCreateCbt, onUploadAnnouncement }) {
  return (
    <div className="rounded-2xl border border-border-subtle bg-bg-panel p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-text-primary">Recent Activity</h3>
        {(onAddUser || onAddAgent || onCreateCbt || onUploadAnnouncement) && (
          <div className="flex flex-wrap gap-2">
            {onAddUser && <ActionButton icon={UserPlus} label="Add User" onClick={onAddUser} />}
            {onAddAgent && <ActionButton icon={UserCog2} label="Add Agent" onClick={onAddAgent} />}
            {onCreateCbt && <ActionButton icon={ClipboardPlus} label="Create CBT" onClick={onCreateCbt} />}
            {onUploadAnnouncement && <ActionButton icon={Megaphone} label="Upload Announcement" onClick={onUploadAnnouncement} />}
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-text-muted">
              <th className="pb-3 font-medium">User</th>
              <th className="pb-3 font-medium">Action</th>
              <th className="pb-3 font-medium">Date</th>
              <th className="pb-3 font-medium">Reference</th>
              <th className="pb-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {activity.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-text-muted">
                  No activity yet -- actions will appear here in real time.
                </td>
              </tr>
            )}
            {activity.map((item) => (
              <tr key={item.id} className="text-text-secondary">
                <td className="py-3 pr-4">
                  <span className="flex items-center gap-2 text-text-primary">
                    {item.avatarUrl ? (
                      <img src={item.avatarUrl} alt="" className="h-6 w-6 rounded-full object-cover" />
                    ) : (
                      <span className="h-6 w-6 rounded-full bg-bg-elevated" />
                    )}
                    {item.userName || "Unknown user"}
                  </span>
                </td>
                <td className="py-3 pr-4">{item.action}</td>
                <td className="py-3 pr-4">{formatTimestamp(item.createdAt)}</td>
                <td className="py-3 pr-4 font-mono text-xs">{item.reference || "--"}</td>
                <td className="py-3">
                  <span
                    className={`rounded-md px-2 py-1 text-xs font-medium ${
                      STATUS_STYLES[item.status] || "bg-bg-elevated text-text-secondary"
                    }`}
                  >
                    {item.status || "logged"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ActionButton({ icon: Icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-md border border-border-subtle bg-bg-elevated px-3 py-1.5 text-xs font-medium text-text-secondary hover:border-accent hover:text-accent"
    >
      <Icon size={13} />
      {label}
    </button>
  );
}
