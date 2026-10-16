import {
  GraduationCap,
  LayoutDashboard,
  FileText,
  ClipboardList,
  BookOpen,
  Settings,
  LogOut,
  Megaphone,
  MessageSquare,
  Mail,
  Users,
  FolderArchive,
  ClipboardCheck,
  Wallet,
  ScrollText,
  Newspaper,
  Feather,
  ShieldCheck,
  Compass,
  Building2,
  GalleryHorizontalEnd,
  Shield,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { canAny, hasTag } from "../lib/roles";

/** Each item shows only when the admin has given this agent the permission. */
const NAV_ITEMS = [
  { label: "Dashboard", icon: LayoutDashboard, to: "/agent" },
  { label: "Staff HQ", icon: MessageSquare, to: "/agent/staff-chat" },
  { label: "Work email", icon: Mail, to: "/agent/mail" },
  { label: "Users", icon: Users, to: "/agent/users", caps: ["users.view"] },
  { label: "Staff access", icon: ShieldCheck, to: "/agent/access", caps: ["users.news", "users.secretary"] },
  { label: "Aspirants", icon: Compass, to: "/agent/aspirants", caps: ["aspirants.view", "aspirants.manage"] },
  { label: "Aspirant Houses", icon: Building2, to: "/agent/houses", caps: ["houses.manage", "users.houseLeader"] },
  { label: "Dashboard board", icon: GalleryHorizontalEnd, to: "/agent/board", caps: ["board.manage"] },
  { label: "Feed & Posts", icon: Megaphone, to: "/agent/announcements", caps: ["announcements.publish"] },
  { label: "Dept Feeds", icon: Megaphone, to: "/agent/feeds" },
  { label: "Documents", icon: FileText, to: "/agent/documents", caps: ["documents.review", "documents.manage"] },
  { label: "Document Center", icon: FolderArchive, to: "/agent/files", caps: ["files.center"] },
  { label: "Academics", icon: GraduationCap, to: "/agent/academics", caps: ["academics.manage"] },
  { label: "Courses", icon: BookOpen, to: "/agent/courses", caps: ["courses.manage"] },
  { label: "CBT Builder", icon: ClipboardList, to: "/agent/cbt-builder", caps: ["cbt.manage"] },
  { label: "Requests", icon: ClipboardCheck, to: "/agent/requests", caps: ["requests.review"] },
  { label: "Payments", icon: Wallet, to: "/agent/payments", caps: ["payments.review"] },
  { label: "Activity log", icon: ScrollText, to: "/agent/activity-log", caps: ["activity.view"] },
  { label: "News desk", icon: Newspaper, to: "/news/desk", duty: ["news", "newsChief"] },
  { label: "Secretariat", icon: Feather, to: "/secretariat", duty: "secretary" },
  { label: "House desk", icon: Shield, to: "/house-desk", duty: "houseLeader" },
];

export default function AgentSidebar({ onNavigate }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, logout } = useAuth();
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

  async function handleLogout() {
    await logout();
    navigate("/", { replace: true });
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
        {NAV_ITEMS.filter((item) => (!item.caps || canAny(profile, ...item.caps)) && (!item.duty || [].concat(item.duty).some((d) => hasTag(profile, d)))).map(({ label, icon: Icon, to }) => {
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
      <button
        type="button"
        onClick={handleLogout}
        className="mt-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.87rem] text-text-secondary hover:bg-bg-panel-alt hover:text-status-danger"
      >
        <LogOut size={17} />
        Log out
      </button>
    </aside>
  );
}
