import { useState } from "react";
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
      <div className="sticky top-0 hidden h-screen lg:flex">
        <UserSidebar onNavigate={() => setMobileNavOpen(false)} />
      </div>

      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div className="animate-slide-in">
            <UserSidebar onNavigate={() => setMobileNavOpen(false)} />
          </div>
          <div
            className="animate-fade flex-1 bg-midnight/50 backdrop-blur-[2px]"
            onClick={() => setMobileNavOpen(false)}
          />
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <UserTopbar
          profile={profile}
          unreadCount={unreadCount}
          search={search}
          onSearchChange={setSearch}
          onMenu={() => setMobileNavOpen(true)}
        />

        {/* More breathing room on mobile */}
        <main className="animate-stitch-in mx-auto w-full max-w-[1320px] flex-1 px-4 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
