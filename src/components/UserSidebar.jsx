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
import BrandLogo from "./BrandLogo";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { isPro } from "../lib/subscription";
import { useUserDashboardData } from "../hooks/useUserDashboardData";

const NAV_ITEMS = [
  { label: "Dashboard", icon: LayoutDashboard, to: "/dashboard" },
  { label: "Courses", icon: BookOpen, to: "/dashboard/courses" },
  { label: "Department", icon: Building2, to: "/dashboard/department", badgeKey: "dept" },
  { label: "Materials", icon: FolderOpen, to: "/dashboard/materials" },
  { label: "Practice/CBT", icon: ClipboardCheck, to: "/dashboard/practice" },
  { label: "Documents", icon: FileText, to: "/dashboard/documents" },
  { label: "Reading Hub", icon: Library, to: "/dashboard/reading-hub" },
  { label: "Reference", icon: BookMarked, to: "/dashboard/reference" },
  { label: "Timetable", icon: Calendar, to: "/dashboard/timetable", proOnly: true },
  { label: "Course Rep", icon: CalendarPlus, to: "/dashboard/course-rep", courseRepOnly: true },
  { label: "Notifications", icon: Bell, to: "/dashboard/notifications", badgeKey: "notif" },
  { label: "Archived", icon: BookOpen, to: "/dashboard/notifications/archived" },
  { label: "Go Pro", icon: Crown, to: "/dashboard/upgrade" },
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
    <aside className="flex w-64 shrink-0 flex-col justify-between bg-bg-sidebar px-4 py-6">
      <div>
        <div className="px-2 pb-8">
          <BrandLogo size={40} stacked textClass="text-text-primary" />
        </div>

        <nav className="space-y-1">
          {NAV_ITEMS.filter((item) => {
            if (item.courseRepOnly) return isRep;
            return true;
          }).map(({ label, icon: Icon, to, proOnly, badgeKey }) => {
            const isActive =
              to === "/dashboard"
                ? location.pathname === "/dashboard"
                : location.pathname.startsWith(to);
            const locked = proOnly && !pro;
            const showBadge =
              unread > 0 &&
              (badgeKey === "notif" ||
                (badgeKey === "dept" && location.pathname !== "/dashboard/department"));
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
                <span className="flex-1 text-left">{label}</span>
                {showBadge && (
                  <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-status-danger px-1 text-[10px] font-bold text-white">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
                {locked && <Lock size={13} className="opacity-70" />}
              </button>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
