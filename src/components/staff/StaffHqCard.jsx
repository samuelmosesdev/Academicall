import { Link } from "react-router-dom";
import { MessageSquare, ArrowRight } from "lucide-react";
import { useStaffShell } from "./StaffShellContext";

/** Compact Staff HQ shortcut for the dashboard side column. */
export default function StaffHqCard() {
  const { variant, badges } = useStaffShell();
  const unread = badges.staffChat || 0;
  return (
    <Link
      to={`/${variant}/staff-chat`}
      className="group block rounded-2xl border border-accent/25 bg-bg-panel p-5 transition hover:border-accent/50 hover:shadow-md"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-bg-app">
          <MessageSquare size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-text-primary">Staff HQ</p>
          <p className="text-xs text-text-muted">
            {unread > 0 ? `${unread} unread message${unread === 1 ? "" : "s"}` : "Team chat, voice notes & meetings"}
          </p>
        </div>
        <ArrowRight size={16} className="shrink-0 text-accent transition group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}
