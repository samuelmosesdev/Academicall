import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { ROLE_LABELS } from "../../lib/roles";
import SidebarFooter from "../SidebarFooter";
import { findCurrent, pathMatches } from "./staffNav";
import { useStaffShell } from "./StaffShellContext";

const STORE_PREFIX = "academicall_staffnav_collapsed_";

/** Rarely-used sections start collapsed; once someone toggles anything, their choice is kept. */
const DEFAULT_COLLAPSED = ["assessment", "oversight", "system"];

function readCollapsed(variant) {
  try {
    const stored = localStorage.getItem(STORE_PREFIX + variant);
    return stored === null ? DEFAULT_COLLAPSED : JSON.parse(stored);
  } catch {
    return DEFAULT_COLLAPSED;
  }
}

function initialsOf(profile) {
  return (
    (profile?.name || profile?.nickname || profile?.email || "S")
      .split(/\s+/)
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "S"
  );
}

/**
 * The staff navigation (Admin and Agents share it). Sections are collapsible and
 * remember their state; the section that holds the current page is always open.
 * The brand sits at the top and the theme switch / sign-out stay pinned at the
 * bottom, so only the list in the middle scrolls.
 */
export default function StaffSidebar({ onNavigate }) {
  const { variant, sections, badges, org } = useStaffShell();
  const { profile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(() => readCollapsed(variant));

  const home = variant === "admin" ? "/admin" : "/agent";
  const profilePath = `${home}/profile`;
  const current = useMemo(() => findCurrent(sections, variant, location.pathname), [sections, variant, location.pathname]);
  const roleLabel = profile?.role === "admin" ? "Admin" : ROLE_LABELS[profile?.role] || "Staff";
  const photo = profile?.photoUrl || profile?.avatarUrl || profile?.photoURL || null;

  useEffect(() => {
    try {
      localStorage.setItem(STORE_PREFIX + variant, JSON.stringify(collapsed));
    } catch {
      /* storage unavailable: the choice just won't persist */
    }
  }, [collapsed, variant]);

  function toggle(id) {
    setCollapsed((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
  }

  return (
    <aside className="sidebar-ink flex h-full w-[16.5rem] shrink-0 flex-col px-3 pb-4 pt-6" aria-label="Staff navigation">
      <button type="button" onClick={() => { navigate(home); onNavigate?.(); }} className="px-3 pb-4 text-left" aria-label="Dashboard">
        <img src="/brand/logo-horizontal-reversed.png" alt="Academicall" className="h-[22px] w-auto" />
      </button>

      <Link
        to={profilePath}
        onClick={() => onNavigate?.()}
        className="mx-1 mb-1 flex items-center gap-3 rounded-2xl border border-border-subtle bg-bg-panel px-3 py-2.5 transition-colors hover:bg-bg-panel-alt"
      >
        {photo ? (
          <img src={photo} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
        ) : (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-lemon text-xs font-semibold text-midnight">
            {initialsOf(profile)}
          </span>
        )}
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold leading-tight text-text-primary">
            {profile?.nickname || profile?.name || "Staff"}
          </span>
          <span className="mt-0.5 block truncate text-xs text-accent">{org?.positionTitle || roleLabel}</span>
          {org?.office && <span className="block truncate text-[0.68rem] text-text-muted">{org.office.name}</span>}
        </span>
      </Link>

      <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-2 pr-0.5" aria-label="Sections">
        {sections.map((section, index) => {
          const holdsCurrent = section.items.some((item) => item === current || (current && item.to === current.to));
          const alwaysOpen = index === 0;
          const open = alwaysOpen || holdsCurrent || !collapsed.includes(section.id);
          const sectionBadge = section.items.reduce((sum, item) => sum + (item.badge ? badges[item.badge] || 0 : 0), 0);
          return (
            <div key={section.id}>
              {alwaysOpen ? (
                <p className="nav-section">{section.label}</p>
              ) : (
                <button
                  type="button"
                  onClick={() => toggle(section.id)}
                  aria-expanded={open}
                  aria-controls={`staffnav-${section.id}`}
                  disabled={holdsCurrent}
                  className="nav-section flex w-full items-center justify-between text-left transition-colors hover:text-white disabled:cursor-default disabled:hover:text-inherit"
                >
                  <span>{section.label}</span>
                  <span className="flex items-center gap-1.5">
                    {!open && sectionBadge > 0 && <span className="h-1.5 w-1.5 rounded-full bg-lemon" aria-label="Has unread items" />}
                    <ChevronDown size={12} className={`transition-transform ${open ? "" : "-rotate-90"}`} />
                  </span>
                </button>
              )}
              {open && (
                <ul id={`staffnav-${section.id}`} className="space-y-0.5">
                  {section.items.map((item) => {
                    const { label, icon: Icon, to, badge } = item;
                    const active = current ? current.to === to : pathMatches(item, location.pathname);
                    const count = badge ? badges[badge] || 0 : 0;
                    return (
                      <li key={`${section.id}-${label}`}>
                        <Link
                          to={to}
                          onClick={() => onNavigate?.()}
                          aria-current={active ? "page" : undefined}
                          className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-[0.86rem] transition-colors ${
                            active ? "nav-item-active" : "text-text-secondary hover:bg-bg-panel-alt hover:text-text-primary"
                          }`}
                        >
                          <Icon size={16} strokeWidth={1.7} className="shrink-0" />
                          <span className="min-w-0 flex-1 truncate leading-tight">{label}</span>
                          {count > 0 && (
                            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-lemon px-1.5 text-[0.7rem] font-semibold text-midnight">
                              {count > 9 ? "9+" : count}
                            </span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </nav>

      <SidebarFooter onNavigate={onNavigate} />
    </aside>
  );
}
