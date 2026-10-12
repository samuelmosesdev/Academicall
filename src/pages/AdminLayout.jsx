import { useState } from "react";
import { Menu } from "lucide-react";
import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";

export default function AdminLayout() {
  const [search, setSearch] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-bg-app">
      <div className="hidden lg:flex">
        <Sidebar onNavigate={() => setMobileNavOpen(false)} />
      </div>

      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <Sidebar onNavigate={() => setMobileNavOpen(false)} />
          <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={() => setMobileNavOpen(false)} />
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-3 border-b border-border-subtle bg-bg-panel px-4 py-3 lg:hidden">
          <button
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open menu"
            className="rounded-lg p-1.5 text-text-secondary hover:bg-bg-hover hover:text-text-primary"
          >
            <Menu size={20} />
          </button>
          <span className="text-sm font-semibold text-text-primary">Academicall · Admin</span>
        </div>
        <Topbar search={search} onSearchChange={setSearch} />

        <main className="animate-stitch-in flex-1 space-y-6 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
