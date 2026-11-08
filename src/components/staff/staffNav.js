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
  Compass,
  Building2,
  GalleryHorizontalEnd,
  MonitorCheck,
  ToggleRight,
  Flag,
  Timer,
  LockKeyhole,
  Database,
  Shield,
  Landmark,
  History,
  Receipt,
  Radio,
  Network,
  ListChecks,
  UsersRound,
} from "lucide-react";
import { canAny, hasTag } from "../../lib/roles";

/**
 * One navigation model for the staff workspace (Admin and Agents).
 *
 * Sections group the 30-odd destinations by the job they belong to, so people find
 * things by task instead of scanning one long list. `badge` names a live counter
 * that StaffShell supplies; `caps` / `duty` hide an item from agents who have not
 * been given that permission (same rules the routes enforce in App.jsx).
 */

export const ADMIN_NAV = [
  {
    id: "overview",
    label: "Overview",
    items: [
      { label: "Dashboard", icon: LayoutDashboard, to: "/admin", end: true },
      { label: "Staff HQ", icon: MessageSquare, to: "/admin/staff-chat", badge: "staffChat" },
      { label: "Notifications", icon: Bell, to: "/admin/notifications", badge: "inbox" },
      { label: "Work email", icon: Mail, to: "/admin/mail" },
      { label: "Dept feeds", icon: Radio, to: "/admin/feeds" },
    ],
  },
  {
    id: "organization",
    label: "Organization",
    items: [
      { label: "Offices & staff", icon: Network, to: "/admin/organization" },
      { label: "Staff tasks", icon: ListChecks, to: "/admin/tasks" },
    ],
  },
  {
    id: "people",
    label: "People",
    items: [
      { label: "Users", icon: Users, to: "/admin/users" },
      { label: "Agents", icon: UserCog, to: "/admin/agents" },
      { label: "Staff access", icon: ShieldCheck, to: "/admin/access" },
      { label: "Aspirants", icon: Compass, to: "/admin/aspirants" },
      { label: "Aspirant houses", icon: Building2, to: "/admin/houses" },
    ],
  },
  {
    id: "content",
    label: "Content",
    items: [
      { label: "Documents", icon: FileText, to: "/admin/documents" },
      { label: "Document Center", icon: FolderArchive, to: "/admin/files" },
      { label: "Academics", icon: GraduationCap, to: "/admin/academics" },
      { label: "Course import", icon: BookOpen, to: "/admin/courses" },
      { label: "Announcements", icon: Megaphone, to: "/admin/announcements" },
      { label: "Dashboard board", icon: GalleryHorizontalEnd, to: "/admin/board" },
      { label: "News desk", icon: Newspaper, to: "/news/desk" },
    ],
  },
  {
    id: "assessment",
    label: "Assessment",
    items: [
      { label: "CBT Builder", icon: ClipboardList, to: "/admin/cbt-builder" },
      { label: "UTME question bank", icon: MonitorCheck, to: "/admin/utme" },
      { label: "Tests", icon: Timer, to: "/admin/tests" },
    ],
  },
  {
    id: "approvals",
    label: "Approvals & money",
    items: [
      { label: "Requests", icon: ClipboardCheck, to: "/admin/requests" },
      { label: "Moderation", icon: Flag, to: "/admin/moderation" },
      { label: "Payments & subscriptions", icon: Wallet, to: "/admin/payments" },
      { label: "Billing & premium", icon: Receipt, to: "/admin/billing" },
    ],
  },
  {
    id: "oversight",
    label: "Oversight",
    items: [
      { label: "Activity", icon: History, to: "/admin/activity" },
      { label: "Activity log", icon: ScrollText, to: "/admin/activity-log" },
      { label: "Audit log", icon: Landmark, to: "/admin/audit-log" },
      { label: "Governance", icon: UserCog, to: "/admin/governance" },
      { label: "Secretariat", icon: Feather, to: "/secretariat" },
    ],
  },
  {
    id: "system",
    label: "System",
    items: [
      { label: "Features", icon: ToggleRight, to: "/admin/features" },
      { label: "Security", icon: LockKeyhole, to: "/admin/security" },
      { label: "Data & backups", icon: Database, to: "/admin/data" },
      { label: "Settings", icon: Settings, to: "/admin/settings" },
    ],
  },
];

/** Agents only see what an admin has given them (`caps`) or a duty they hold (`duty`). */
export const AGENT_NAV = [
  {
    id: "overview",
    label: "Overview",
    items: [
      { label: "Dashboard", icon: LayoutDashboard, to: "/agent", end: true },
      { label: "My work", icon: ListChecks, to: "/agent/my-work", badge: "myTasks" },
      { label: "My team", icon: UsersRound, to: "/agent/my-team", supervisor: true },
      { label: "Staff HQ", icon: MessageSquare, to: "/agent/staff-chat", badge: "staffChat" },
      { label: "Work email", icon: Mail, to: "/agent/mail" },
      { label: "Dept feeds", icon: Radio, to: "/agent/feeds" },
    ],
  },
  {
    id: "people",
    label: "People",
    items: [
      { label: "Users", icon: Users, to: "/agent/users", caps: ["users.view"] },
      { label: "Staff access", icon: ShieldCheck, to: "/agent/access", caps: ["users.news", "users.secretary"] },
      { label: "Aspirants", icon: Compass, to: "/agent/aspirants", caps: ["aspirants.view", "aspirants.manage"] },
      { label: "Aspirant houses", icon: Building2, to: "/agent/houses", caps: ["houses.manage", "users.houseLeader"] },
      { label: "House desk", icon: Shield, to: "/house-desk", duty: "houseLeader" },
    ],
  },
  {
    id: "content",
    label: "Content",
    items: [
      { label: "Documents", icon: FileText, to: "/agent/documents", caps: ["documents.review", "documents.manage"] },
      { label: "Document Center", icon: FolderArchive, to: "/agent/files", caps: ["files.center"] },
      { label: "Academics", icon: GraduationCap, to: "/agent/academics", caps: ["academics.manage", "courses.manage"] },
      { label: "Courses", icon: BookOpen, to: "/agent/courses", caps: ["courses.manage"] },
      { label: "Feed & posts", icon: Megaphone, to: "/agent/announcements", caps: ["announcements.publish"] },
      { label: "Dashboard board", icon: GalleryHorizontalEnd, to: "/agent/board", caps: ["board.manage"] },
      { label: "News desk", icon: Newspaper, to: "/news/desk", duty: ["news", "newsChief"] },
    ],
  },
  {
    id: "assessment",
    label: "Assessment",
    items: [
      { label: "CBT Builder", icon: ClipboardList, to: "/agent/cbt-builder", caps: ["cbt.manage"] },
      { label: "UTME question bank", icon: MonitorCheck, to: "/agent/utme", caps: ["utme.manage"] },
      { label: "Tests", icon: Timer, to: "/agent/tests", caps: ["tests.manage"] },
    ],
  },
  {
    id: "approvals",
    label: "Approvals & money",
    items: [
      { label: "Requests", icon: ClipboardCheck, to: "/agent/requests", caps: ["requests.review"] },
      { label: "Moderation", icon: Flag, to: "/agent/moderation", caps: ["moderation.manage"] },
      { label: "Payments", icon: Wallet, to: "/agent/payments", caps: ["payments.review"] },
    ],
  },
  {
    id: "oversight",
    label: "Oversight",
    items: [
      { label: "Activity log", icon: ScrollText, to: "/agent/activity-log", caps: ["activity.view"] },
      { label: "Secretariat", icon: Feather, to: "/secretariat", duty: "secretary" },
    ],
  },
];

/** Pages that live inside the shell but are not sidebar items. */
const EXTRA_PAGES = {
  admin: [
    { label: "Profile", to: "/admin/profile", section: "Account" },
  ],
  agent: [
    { label: "Profile", to: "/agent/profile", section: "Account" },
    { label: "Settings", to: "/agent/settings", section: "Account" },
  ],
};

/** Keep the items this person may use; drop sections left empty. */
export function visibleSections(sections, profile, org) {
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) =>
          (!item.caps || canAny(profile, ...item.caps)) &&
          (!item.duty || [].concat(item.duty).some((d) => hasTag(profile, d))) &&
          (!item.supervisor || org?.isSupervisor)
      ),
    }))
    .filter((section) => section.items.length > 0);
}

/** Exact page, or anything beneath it. `/admin/activity` must NOT match `/admin/activity-log`. */
export function pathMatches(item, pathname) {
  if (item.end) return pathname === item.to || pathname === `${item.to}/`;
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}

/** Flat list for search and breadcrumbs. */
export function flattenNav(sections, variant) {
  const flat = [];
  sections.forEach((section) =>
    section.items.forEach((item) => flat.push({ ...item, section: section.label, sectionId: section.id }))
  );
  (EXTRA_PAGES[variant] || []).forEach((page) => flat.push({ ...page, extra: true }));
  return flat;
}

/** Best match (longest path) for the current URL, used for the active item and breadcrumb. */
export function findCurrent(sections, variant, pathname) {
  let best = null;
  flattenNav(sections, variant).forEach((item) => {
    if (!pathMatches(item, pathname)) return;
    if (!best || item.to.length > best.to.length) best = item;
  });
  return best;
}
