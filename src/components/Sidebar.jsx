import {
  LayoutDashboard,
  Users,
  UserCog,
  FileText,
  ClipboardList,
  BookOpen,
  Wallet,
  Megaphone,
  Settings,
  LogOut,
  ClipboardCheck,
  ScrollText,
  MessageSquare,
  Mail,
} from "lucide-react";
import BrandLogo from "./BrandLogo";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const NAV_ITEMS = [
  { label: "Dashboard", icon: LayoutDashboard, to: "/admin" },
  { label: "Staff HQ", icon: MessageSquare, to: "/admin/staff-chat" },
  { label: "Work email", icon: Mail, to: "/admin/mail" },
  { label: "Dept Feeds", icon: Megaphone, to: "/admin/feeds" },
  { label: "Users", icon: Users, to: "/admin/users" },
  { label: "Activity", icon: ScrollText, to: "/admin/activity" },
  { label: "Governance", icon: UserCog, to: "/admin/governance" },
  { label: "Audit Log", icon: ScrollText, to: "/admin/audit-log" },
  { label: "Agents", icon: UserCog, to: "/admin/agents" },
  { label: "Documents", icon: FileText, to: "/admin/documents" },
  { label: "Courses", icon: BookOpen, to: "/admin/courses" },
  { label: "CBT Builder", icon: ClipboardList, to: "/admin/cbt-builder" },
  { label: "Requests", icon: ClipboardCheck, to: "/admin/requests" },
  { label: "Activity log", icon: ScrollText, to: "/admin/activity-log" },
  { label: "Payments & Subscription", icon: Wallet, to: "/admin/payments" },
  { label: "Announcements", icon: Megaphone, to: "/admin/announcements" },
  { label: "Settings", icon: Settings, to: "/admin/settings" },
];

export default function Sidebar({ onNavigate }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();

  function go(to) {
    navigate(to);
    onNavigate?.();
  }

  async function handleLogout() {
    await logout();
    navigate("/", { replace: true });
    onNavigate?.();
  }

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-border-subtle bg-bg-sidebar px-4 py-6 shadow-[var(--shadow-sidebar)]">
      <div className="px-2 pb-8">
        <BrandLogo size={36} textClass="text-text-primary" />
      </div>

      <nav className="flex-1 space-y-1">
        {NAV_ITEMS.map(({ label, icon: Icon, to }) => {
          const isActive =
            to === "/admin"
              ? location.pathname === "/admin"
              : location.pathname.startsWith(to);
          return (
            <button
              key={label}
              type="button"
              onClick={() => go(to)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                isActive
                  ? "nav-item-active"
                  : "text-text-secondary hover:bg-bg-panel-alt hover:text-text-primary"
              }`}
            >
              <Icon size={17} strokeWidth={2} />
              <span className="text-left leading-tight">{label}</span>
            </button>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={handleLogout}
        className="mt-4 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-status-danger hover:bg-status-danger/10"
      >
        <LogOut size={17} />
        Log out
      </button>
    </aside>
  );
}