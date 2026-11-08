import {
  Feather,
  LayoutDashboard,
  BookOpen,
  ClipboardCheck,
  Library,
  BookOpenText,
  Calendar,
  Bell,
  Crown,
  UserCircle,
  Settings,
  Lock,
  BookMarked,
  CalendarPlus,
  Building2,
  MessagesSquare,
  ShieldCheck,
  Newspaper,
  PenSquare,
  Compass,
  Shield,
  Target,
  MonitorCheck,
  Calculator,
  Download,
  Timer,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { isHouseLeader, isNewsAgent, isSecretary } from "../lib/roles";
import { useAuth } from "../context/AuthContext";
import { isPro } from "../lib/subscription";
import { useUserDashboardData } from "../hooks/useUserDashboardData";
import { useGroups } from "../hooks/useGroups";
import SidebarFooter from "./SidebarFooter";
import { useFeatures } from "../lib/features";

const NAV_ITEMS = [
  { section: "Study" },
  { label: "Dashboard", icon: LayoutDashboard, to: "/dashboard" },
  { label: "Courses", icon: BookOpen, to: "/dashboard/courses", feature: "courses" },
  { label: "Programme", icon: Building2, to: "/dashboard/department", badgeKey: "dept", feature: "programme" },
  { label: "Groups", icon: MessagesSquare, to: "/dashboard/groups", badgeKey: "groups", feature: "groups" },
  { label: "Library", icon: Library, to: "/dashboard/materials", feature: "materials" },
  { label: "Vault", icon: ShieldCheck, to: "/dashboard/vault", feature: "vault" },
  { label: "News", icon: Newspaper, to: "/news", feature: "news" },
  { label: "News desk", icon: PenSquare, to: "/news/desk", newsAgentOnly: true, feature: "news" },
  { label: "Secretariat", icon: Feather, to: "/secretariat", secretaryOnly: true, feature: "secretariat" },
  { label: "House desk", icon: Shield, to: "/house-desk", houseLeaderOnly: true, feature: "aspirantHouse" },
  { label: "Practice/CBT", icon: ClipboardCheck, to: "/dashboard/practice", feature: "practice" },
  { label: "Tests", icon: Timer, to: "/dashboard/tests", feature: "tests" },
  { label: "CGPA & results", icon: Calculator, to: "/dashboard/results", feature: "results" },
  { label: "Downloads", icon: Download, to: "/dashboard/downloads", feature: "downloads" },
  { label: "Reading Hub", icon: BookOpenText, to: "/dashboard/reading-hub", feature: "readingHub" },
  { label: "Reference", icon: BookMarked, to: "/dashboard/reference", feature: "reference" },
  { label: "Timetable", icon: Calendar, to: "/dashboard/timetable", proOnly: true, feature: "timetable" },
  { section: "Course rep", courseRepOnly: true, feature: "courseRep" },
  { label: "Course Rep", icon: CalendarPlus, to: "/dashboard/course-rep", courseRepOnly: true, feature: "courseRep" },
  { section: "Account" },
  { label: "Notifications", icon: Bell, to: "/dashboard/notifications", badgeKey: "notif" },
  { label: "Archived", icon: BookOpen, to: "/dashboard/notifications/archived" },
  { label: "Profile", icon: UserCircle, to: "/dashboard/profile" },
  { label: "Settings", icon: Settings, to: "/dashboard/settings" },
];

/** Aspirants: no department, courses or library yet. Their home is the Aspirant House. */
const ASPIRANT_NAV = [
  { section: "Admission" },
  { label: "Dashboard", icon: LayoutDashboard, to: "/dashboard" },
  { label: "Aspirant House", icon: Compass, to: "/dashboard/house", badgeKey: "house", feature: "aspirantHouse" },
  { label: "My choices", icon: Target, to: "/dashboard/choices", feature: "choices" },
  { label: "UTME CBT", icon: MonitorCheck, to: "/dashboard/utme", feature: "utme" },
  { label: "Tests", icon: Timer, to: "/dashboard/tests", feature: "tests" },
  { label: "News", icon: Newspaper, to: "/news", feature: "news" },
  { label: "Practice/CBT", icon: ClipboardCheck, to: "/dashboard/practice", feature: "practice" },
  { label: "Vault", icon: ShieldCheck, to: "/dashboard/vault", feature: "vault" },
  { label: "Downloads", icon: Download, to: "/dashboard/downloads", feature: "downloads" },
  { section: "Account" },
  { label: "Notifications", icon: Bell, to: "/dashboard/notifications", badgeKey: "notif" },
  { label: "Archived", icon: BookOpen, to: "/dashboard/notifications/archived" },
  { label: "Profile", icon: UserCircle, to: "/dashboard/profile" },
  { label: "Settings", icon: Settings, to: "/dashboard/settings" },
];

export default function UserSidebar({ onNavigate }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const pro = isPro(profile);
  const isRep = profile?.role === "courseRep";
  const aspirant = profile?.role === "aspirant";
  const { totalUnread: groupUnread = 0 } = useGroups(user?.uid);
  const { unreadCount: unread = 0 } = useUserDashboardData();
  const { isOn } = useFeatures();

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
        {(aspirant ? ASPIRANT_NAV : NAV_ITEMS).filter((item) => {
          if (item.feature && !isOn(item.feature)) return false;
          if (item.courseRepOnly) return isRep;
          if (item.newsAgentOnly) return isNewsAgent(profile);
          if (item.secretaryOnly) return isSecretary(profile);
          if (item.houseLeaderOnly) return isHouseLeader(profile);
          return true;
        }).map((item) => {
          if (item.section) return <p key={item.section} className="nav-section">{item.section}</p>;
          const { label, icon: Icon, to, proOnly, badgeKey } = item;
          const isActive =
            to === "/dashboard"
              ? location.pathname === "/dashboard"
              : to === "/dashboard/notifications"
                ? location.pathname === to
                : location.pathname.startsWith(to);
          const locked = proOnly && !pro;
          const badgeCount = badgeKey === "groups" ? groupUnread : badgeKey === "house" ? 0 : unread;
          const showBadge =
            badgeCount > 0 &&
            (badgeKey === "notif" || badgeKey === "groups" || (badgeKey === "dept" && location.pathname !== "/dashboard/department"));
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
                <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-lemon px-1.5 text-[0.7rem] font-semibold text-midnight">
                  {badgeCount > 9 ? "9+" : badgeCount}
                </span>
              )}
              {locked && <Lock size={13} className="opacity-50" />}
            </button>
          );
        })}
      </nav>

      {!pro && !aspirant && isOn("upgrade") && (
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
