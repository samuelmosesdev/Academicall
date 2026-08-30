import { useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { authApi } from "../lib/api";
import { homePathFor } from "../lib/roles";
import { useNavigate } from "react-router-dom";

const field =
  "w-full rounded-xl border border-border-subtle bg-bg-panel px-3 py-2.5 text-sm text-text-primary focus:border-accent focus:outline-none";

export default function ForceChangePassword() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!user) return;
    if (next.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (next !== confirm) {
      setError("New passwords do not match.");
      return;
    }
    if (next === current) {
      setError("Choose a different password from the temporary one.");
      return;
    }
    setBusy(true);
    try {
      await authApi.changePassword({ currentPassword: current, newPassword: next });
      navigate(homePathFor(profile), { replace: true });
    } catch (err) {
      const code = err?.code || "";
      if (code.includes("wrong-password") || code.includes("invalid-credential")) {
        setError("Current (temporary) password is incorrect.");
      } else if (code.includes("requires-recent-login")) {
        setError("Session expired. Sign out, sign in with the temporary password, then try again.");
      } else {
        setError(err.message || "Could not update password.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-app px-4">
      <div className="w-full max-w-md rounded-2xl border border-border-subtle bg-bg-panel p-6 sm:p-8">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-bg-app">
          <KeyRound size={22} />
        </div>
        <h1 className="text-xl font-semibold text-text-primary">Set a new password</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Your admin created a temporary password for{" "}
          <span className="font-medium text-text-primary">{user?.email}</span>. Choose
          your own before continuing.
        </p>

        {error && (
          <p className="mt-4 rounded-xl border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-sm text-status-danger">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-3">
          <div>
            <label className="mb-1 block text-xs text-text-muted">Current (temporary) password</label>
            <input
              type="password"
              className={field}
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-text-muted">New password</label>
            <input
              type="password"
              className={field}
              value={next}
              onChange={(e) => setNext(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-text-muted">Confirm new password</label>
            <input
              type="password"
              className={field}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-2.5 text-sm font-semibold text-bg-app disabled:opacity-60"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : null}
            Save and continue
          </button>
        </form>
      </div>
    </div>
  );
}
