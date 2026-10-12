import { useState } from "react";
import { Menu } from "lucide-react";
import { Outlet } from "react-router-dom";
import AgentSidebar from "../components/AgentSidebar";
import Topbar from "../components/Topbar";

export default function AgentLayout() {
  const [search, setSearch] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-bg-app">
      <div className="hidden lg:flex">
        <AgentSidebar onNavigate={() => setMobileNavOpen(false)} />
      </div>

      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <AgentSidebar onNavigate={() => setMobileNavOpen(false)} />
          <div className="flex-1 bg-black/50" onClick={() => setMobileNavOpen(false)} />
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-3 border-b border-border-subtle bg-bg-app px-4 pt-4 lg:hidden">
          <button onClick={() => setMobileNavOpen(true)} aria-label="Open menu" className="text-text-secondary">
            <Menu size={20} />
          </button>
        </div>
        <Topbar search={search} onSearchChange={setSearch} />

        <main className="animate-stitch-in flex-1 space-y-6 px-4 py-6 sm:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
