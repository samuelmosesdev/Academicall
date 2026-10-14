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
  ClipboardCheck,
  ScrollText,
  MessageSquare,
  Mail,
  Bell,
  GraduationCap,
  Newspaper,
  ShieldCheck,
  FolderArchive,
  Feather,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import SidebarFooter from "./SidebarFooter";

const NAV_ITEMS = [
  { label: "Dashboard", icon: LayoutDashboard, to: "/admin" },
  { label: "Staff HQ", icon: MessageSquare, to: "/admin/staff-chat" },
  { label: "Work email", icon: Mail, to: "/admin/mail" },
  { label: "Dept Feeds", icon: Megaphone, to: "/admin/feeds" },
  { label: "Users", icon: Users, to: "/admin/users" },
  { label: "Staff access", icon: ShieldCheck, to: "/admin/access" },
  { label: "Activity", icon: ScrollText, to: "/admin/activity" },
  { label: "Governance", icon: UserCog, to: "/admin/governance" },
  { label: "Academic catalog", icon: GraduationCap, to: "/admin/governance/academic-catalog" },
  { label: "Audit Log", icon: ScrollText, to: "/admin/audit-log" },
  { label: "Notifications", icon: Bell, to: "/admin/notifications" },
  { label: "Agents", icon: UserCog, to: "/admin/agents" },
  { label: "Documents", icon: FileText, to: "/admin/documents" },
  { label: "Document Center", icon: FolderArchive, to: "/admin/files" },
  { label: "Courses", icon: BookOpen, to: "/admin/courses" },
  { label: "CBT Builder", icon: ClipboardList, to: "/admin/cbt-builder" },
  { label: "Requests", icon: ClipboardCheck, to: "/admin/requests" },
  { label: "Activity log", icon: ScrollText, to: "/admin/activity-log" },
  { label: "Payments & Subscription", icon: Wallet, to: "/admin/payments" },
  { label: "Announcements", icon: Megaphone, to: "/admin/announcements" },
  { label: "News desk", icon: Newspaper, to: "/news/desk" },
  { label: "Secretariat", icon: Feather, to: "/secretariat" },
  { label: "Settings", icon: Settings, to: "/admin/settings" },
];

export default function Sidebar({ onNavigate }) {
  const location = useLocation();
  const navigate = useNavigate();
  function go(to) {
    navigate(to);
    onNavigate?.();
  }

  return (
    <aside className="sidebar-ink flex h-full w-[16.5rem] shrink-0 flex-col overflow-y-auto px-3 pb-5 pt-7">
      <div className="px-3 pb-6">
        <img src="/brand/logo-horizontal-reversed.png" alt="Academicall" className="h-[22px] w-auto" />
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
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[0.87rem] transition-colors ${
                isActive
                  ? "nav-item-active"
                  : "text-text-secondary hover:bg-bg-panel-alt hover:text-text-primary"
              }`}
            >
              <Icon size={17} strokeWidth={1.7} />
              <span className="text-left leading-tight">{label}</span>
            </button>
          );
        })}
      </nav>

      <SidebarFooter onNavigate={onNavigate} />
    </aside>
  );
}