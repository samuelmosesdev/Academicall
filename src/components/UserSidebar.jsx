import {
  LayoutDashboard,
  BookOpen,
  ClipboardCheck,
  Library,
  Calendar,
  Bell,
  Crown,
  UserCircle,
  Settings,
  Lock,
  BookMarked,
  CalendarPlus,
  Building2,
  FolderOpen,
  FileText,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { isPro } from "../lib/subscription";
import { useUserDashboardData } from "../hooks/useUserDashboardData";
import SidebarFooter from "./SidebarFooter";

const NAV_ITEMS = [
  { section: "Study" },
  { label: "Dashboard", icon: LayoutDashboard, to: "/dashboard" },
  { label: "Courses", icon: BookOpen, to: "/dashboard/courses" },
  { label: "Programme", icon: Building2, to: "/dashboard/department", badgeKey: "dept" },
  { label: "Materials", icon: FolderOpen, to: "/dashboard/materials" },
  { label: "Practice/CBT", icon: ClipboardCheck, to: "/dashboard/practice" },
  { label: "Documents", icon: FileText, to: "/dashboard/documents" },
  { label: "Reading Hub", icon: Library, to: "/dashboard/reading-hub" },
  { label: "Reference", icon: BookMarked, to: "/dashboard/reference" },
  { label: "Timetable", icon: Calendar, to: "/dashboard/timetable", proOnly: true },
  { section: "Course rep", courseRepOnly: true },
  { label: "Course Rep", icon: CalendarPlus, to: "/dashboard/course-rep", courseRepOnly: true },
  { section: "Account" },
  { label: "Notifications", icon: Bell, to: "/dashboard/notifications", badgeKey: "notif" },
  { label: "Archived", icon: BookOpen, to: "/dashboard/notifications/archived" },
  { label: "Profile", icon: UserCircle, to: "/dashboard/profile" },
  { label: "Settings", icon: Settings, to: "/dashboard/settings" },
];

export default function UserSidebar({ onNavigate }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const pro = isPro(profile);
  const isRep = profile?.role === "courseRep";
  const { unreadCount: unread = 0 } = useUserDashboardData();

  function go(to) {
    navigate(to);
    onNavigate?.();
  }

  return (
    <aside className="sidebar-ink flex h-full w-[16.5rem] shrink-0 flex-col overflow-y-auto px-3 pb-5 pt-7">
      <button type="button" onClick={() => go("/dashboard")} className="px-3 pb-3 text-left" aria-label="Dashboard">
        <img src="/brand/logo-horizontal-reversed.png" alt="Academicall" className="h-[22px] w-auto" />
      </button>

      <nav className="flex-1">
        {NAV_ITEMS.filter((item) => (item.courseRepOnly ? isRep : true)).map((item) => {
          if (item.section) return <p key={item.section} className="nav-section">{item.section}</p>;
          const { label, icon: Icon, to, proOnly, badgeKey } = item;
          const isActive =
            to === "/dashboard"
              ? location.pathname === "/dashboard"
              : to === "/dashboard/notifications"
                ? location.pathname === to
                : location.pathname.startsWith(to);
          const locked = proOnly && !pro;
          const showBadge =
            unread > 0 &&
            (badgeKey === "notif" || (badgeKey === "dept" && location.pathname !== "/dashboard/department"));
          return (
            <button
              key={label}
              type="button"
              onClick={() => go(to)}
              aria-current={isActive ? "page" : undefined}
              className={`group mb-0.5 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[0.87rem] transition-colors ${
                isActive ? "nav-item-active" : "text-text-secondary hover:bg-bg-panel-alt hover:text-text-primary"
              }`}
            >
              <Icon size={17} strokeWidth={1.7} />
              <span className="flex-1 text-left">{label}</span>
              {showBadge && (
                <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-lemon px-1.5 text-[10px] font-semibold text-midnight">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
              {locked && <Lock size={13} className="opacity-50" />}
            </button>
          );
        })}
      </nav>

      {!pro && (
        <button
          type="button"
          onClick={() => go("/dashboard/upgrade")}
          className="mx-1 mt-6 rounded-2xl bg-lemon p-4 text-left text-midnight transition hover:brightness-105"
        >
          <div className="flex items-center justify-between">
            <span className="eyebrow text-midnight/60">Pro</span>
            <Crown size={16} />
          </div>
          <p className="mt-3 text-[0.95rem] font-semibold leading-snug">Unlock your timetable</p>
          <p className="mt-1 text-xs leading-relaxed text-midnight/65">Plus unlimited AI quizzes.</p>
        </button>
      )}
      <SidebarFooter onNavigate={onNavigate} />
    </aside>
  );
}
