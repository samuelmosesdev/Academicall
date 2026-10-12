import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";

export default function AdminLayout() {
  const [search, setSearch] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-bg-app">
      <div className="sticky top-0 hidden h-screen lg:flex">
        <Sidebar onNavigate={() => setMobileNavOpen(false)} />
      </div>

      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div className="animate-slide-in"><Sidebar onNavigate={() => setMobileNavOpen(false)} /></div>
          <div className="animate-fade flex-1 bg-midnight/50 backdrop-blur-[2px]" onClick={() => setMobileNavOpen(false)} />
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar search={search} onSearchChange={setSearch} onMenu={() => setMobileNavOpen(true)} />

        <main className="animate-stitch-in mx-auto w-full max-w-[1400px] flex-1 space-y-6 px-4 py-6 sm:px-8 sm:py-8 lg:px-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
