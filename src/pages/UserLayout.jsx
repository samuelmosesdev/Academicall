import { useState } from "react";
import { Menu } from "lucide-react";
import { Outlet } from "react-router-dom";
import UserSidebar from "../components/UserSidebar";
import UserTopbar from "../components/UserTopbar";
import {
  UserDashboardDataProvider,
  useUserDashboardData,
} from "../hooks/useUserDashboardData";

/**
 * The provider owns the single set of dashboard listeners; this shell and every
 * routed child read from it. Do not call the subscribing hook anywhere else.
 */
export default function UserLayout() {
  return (
    <UserDashboardDataProvider>
      <UserLayoutShell />
    </UserDashboardDataProvider>
  );
}

function UserLayoutShell() {
  const { profile, unreadCount } = useUserDashboardData();
  const [search, setSearch] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-bg-app transition-colors duration-300">
      <div className="hidden lg:flex">
        <UserSidebar onNavigate={() => setMobileNavOpen(false)} />
      </div>

      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div className="animate-slide-in">
            <UserSidebar onNavigate={() => setMobileNavOpen(false)} />
          </div>
          <div
            className="flex-1 bg-black/40 backdrop-blur-sm"
            onClick={() => setMobileNavOpen(false)}
          />
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile header bar */}
        <div className="flex items-center gap-3 border-b border-border-subtle bg-bg-panel px-4 py-3 lg:hidden">
          <button
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open menu"
            className="rounded-xl p-2 text-text-secondary hover:bg-bg-hover hover:text-text-primary"
          >
            <Menu size={20} />
          </button>
          <span className="text-sm font-bold text-text-primary">Academicall</span>
        </div>

        <UserTopbar
          profile={profile}
          unreadCount={unreadCount}
          search={search}
          onSearchChange={setSearch}
        />

        {/* More breathing room on mobile */}
        <main className="flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
