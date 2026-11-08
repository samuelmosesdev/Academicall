/**
 * Shown to staff when an admin requires two-step sign-in and theirs isn't on
 * yet. The API only answers set-up calls until it is.
 */
import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { homePathFor } from "../lib/roles";
import BrandLogo from "../components/BrandLogo";
import { TwoFactorSection } from "../components/settings/AccountSafety";

export default function SecuritySetup() {
  const { profile, refreshProfile, logout } = useAuth();
  const navigate = useNavigate();
  async function done() {
    const p = await refreshProfile().catch(() => profile);
    navigate(homePathFor(p || profile), { replace: true });
  }
  return (
    <div className="min-h-screen bg-bg-app px-4 py-10">
      <div className="mx-auto max-w-xl space-y-6">
        <div className="flex items-center justify-between">
          <BrandLogo />
          <button type="button" className="ctl-btn is-ghost" onClick={async () => { await logout(); navigate("/login", { replace: true }); }}><LogOut size={14} /> Sign out</button>
        </div>
        <div>
          <h1 className="font-display text-[2rem] leading-tight text-text-primary">Turn on two-step sign-in</h1>
          <p className="mt-2 text-sm text-text-secondary">
            Staff accounts can see and change other people's data, so an admin has made a second step at sign-in required. It takes about a minute.
          </p>
        </div>
        <TwoFactorSection required onDone={done} />
      </div>
    </div>
  );
}
