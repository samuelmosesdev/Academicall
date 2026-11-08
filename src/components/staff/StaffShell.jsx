import { useEffect, useMemo, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useNotifications } from "../../hooks/useNotifications";
import { useStaffChatUnread } from "../../hooks/useStaffChatUnread";
import { useMyOrg } from "../../hooks/useMyOrg";
import { isAdmin } from "../../lib/roles";
import Topbar from "../Topbar";
import StaffSidebar from "./StaffSidebar";
import { StaffShellProvider } from "./StaffShellContext";
import { ADMIN_NAV, AGENT_NAV, visibleSections } from "./staffNav";

/**
 * The workspace frame for Admin and Agents: sidebar, top bar and page area.
 * `variant` is "admin" or "agent" (AdminLayout / AgentLayout are thin wrappers).
 */
export default function StaffShell({ variant }) {
  const { profile } = useAuth();
  const location = useLocation();
  const [search, setSearch] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { unread: staffChat } = useStaffChatUnread();
  const { unreadCount: inbox } = useNotifications();
  const { org } = useMyOrg();

  const sections = useMemo(
    () => (variant === "admin" ? ADMIN_NAV : visibleSections(AGENT_NAV, profile, org)),
    [variant, profile, org]
  );
  const badges = useMemo(
    () => ({ staffChat, inbox: isAdmin(profile) ? inbox : 0, myTasks: org?.tasks?.open || 0 }),
    [staffChat, inbox, profile, org]
  );
  const shell = useMemo(() => ({ variant, sections, badges, org }), [variant, sections, badges, org]);

  // Close the drawer when the page changes, on Escape, and stop the page scrolling behind it.
  useEffect(() => { setMobileNavOpen(false); }, [location.pathname]);
  useEffect(() => {
    if (!mobileNavOpen) return undefined;
    const onKey = (e) => e.key === "Escape" && setMobileNavOpen(false);
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [mobileNavOpen]);

  return (
    <StaffShellProvider value={shell}>
      <div className="flex min-h-screen bg-bg-app">
        <a
          href="#staff-main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-full focus:bg-lemon focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-midnight"
        >
          Skip to content
        </a>

        <div className="sticky top-0 hidden h-screen lg:flex">
          <StaffSidebar />
        </div>

        {mobileNavOpen && (
          <div className="fixed inset-0 z-40 flex lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
            <div className="animate-slide-in h-full"><StaffSidebar onNavigate={() => setMobileNavOpen(false)} /></div>
            <div className="animate-fade flex-1 bg-midnight/50 backdrop-blur-[2px]" onClick={() => setMobileNavOpen(false)} />
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar search={search} onSearchChange={setSearch} onMenu={() => setMobileNavOpen(true)} />
          <main id="staff-main" className="animate-stitch-in mx-auto w-full max-w-[1400px] flex-1 space-y-6 px-4 py-6 sm:px-8 sm:py-8 lg:px-10">
            <Outlet />
          </main>
        </div>
      </div>
    </StaffShellProvider>
  );
}
