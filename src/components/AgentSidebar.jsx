import {
  LayoutDashboard,
  FileText,
  ClipboardList,
  BookOpen,
  Settings,
  Megaphone,
  MessageSquare,
  Mail,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import SidebarFooter from "./SidebarFooter";

const NAV_ITEMS = [
  { label: "Dashboard", icon: LayoutDashboard, to: "/agent" },
  { label: "Staff HQ", icon: MessageSquare, to: "/agent/staff-chat" },
  { label: "Work email", icon: Mail, to: "/agent/mail" },
  { label: "Feed & Posts", icon: Megaphone, to: "/agent/announcements" },
  { label: "Dept Feeds", icon: Megaphone, to: "/agent/feeds" },
  { label: "Documents", icon: FileText, to: "/agent/documents" },
  { label: "Courses", icon: BookOpen, to: "/agent/courses" },
  { label: "CBT Builder", icon: ClipboardList, to: "/agent/cbt-builder" },
];

export default function AgentSidebar({ onNavigate }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const roleLabel =
    profile?.role === "alphaAgent"
      ? "Alpha Agent"
      : profile?.role === "agent"
        ? "Agent"
        : "Staff";

  function go(to) {
    navigate(to);
    onNavigate?.();
  }

  return (
    <aside className="sidebar-ink flex h-full w-[16.5rem] shrink-0 flex-col overflow-y-auto px-3 pb-5 pt-7">
      <div className="px-2 pb-4">
        <img src="/brand/logo-horizontal-reversed.png" alt="Academicall" className="h-[22px] w-auto" />
      </div>

      <div className="mb-6 mx-2 rounded-xl border border-border-subtle bg-bg-panel px-3 py-2.5">
        <p className="text-sm font-semibold text-text-primary truncate">
          {profile?.nickname || profile?.name || "Staff"}
        </p>
        <p className="text-[11px] font-medium text-accent mt-0.5">{roleLabel}</p>
      </div>

      <nav className="flex-1 space-y-1">
        {NAV_ITEMS.map(({ label, icon: Icon, to }) => {
          const isActive =
            to === "/agent"
              ? location.pathname === "/agent"
              : location.pathname.startsWith(to);
          return (
            <button
              key={label}
              type="button"
              onClick={() => go(to)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[0.87rem] transition-colors ${
                isActive
                  ? "bg-bg-elevated text-text-primary font-medium"
                  : "text-text-secondary hover:bg-bg-panel-alt hover:text-text-primary"
              }`}
            >
              <Icon size={17} strokeWidth={1.7} />
              <span className="text-left leading-tight">{label}</span>
            </button>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={() => go("/agent/settings")}
        className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.87rem] text-text-secondary hover:bg-bg-panel-alt hover:text-text-primary"
      >
        <Settings size={17} />
        Settings
      </button>
      <SidebarFooter onNavigate={onNavigate} />
    </aside>
  );
}
