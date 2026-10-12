import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { KeyRound } from "lucide-react";
import AuthAmbientBackground from "../components/AuthAmbientBackground";
import { authApi } from "../lib/api";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    if (!token) return setError("This reset link is missing its token.");
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirm) return setError("Passwords do not match.");
    setBusy(true);
    try {
      await authApi.confirmPasswordReset({ token, password });
      setDone(true);
    } catch (err) {
      setError(err.message || "Could not reset password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <AuthAmbientBackground />
      <div className="animate-stitch-in relative z-10 w-full max-w-sm rounded-2xl border border-white/15 bg-[#0b1220]/85 p-8 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl">
        <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-[#d6e64a] text-[#101c30]">
          <KeyRound size={21} />
        </div>
        <h1 className="text-xl font-semibold text-white">Choose a new password</h1>
        <p className="mt-1 text-sm text-white/70">Use at least 8 characters for your new password.</p>

        {error && <p className="mt-4 rounded-lg border border-red-400/40 bg-red-500/15 px-3 py-2 text-sm text-red-200">{error}</p>}
        {done ? (
          <div className="mt-5 space-y-4">
            <p className="rounded-xl border border-[#78a0ff]/30 bg-[#3d6fe0]/15 px-3 py-3 text-sm text-[#dce7ff]">Your password has been updated.</p>
              <button type="button" onClick={() => navigate("/login", { replace: true })} className="w-full rounded-xl bg-[#3d6fe0] px-3 py-3 text-sm font-semibold text-white transition hover:bg-[#14355e]">Back to sign in</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <input type="password" required minLength={8} autoComplete="new-password" placeholder="New password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-[#78a0ff] focus:outline-none focus:ring-4 focus:ring-[#78a0ff]/15" />
            <input type="password" required minLength={8} autoComplete="new-password" placeholder="Confirm new password" value={confirm} onChange={(event) => setConfirm(event.target.value)} className="w-full rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-[#78a0ff] focus:outline-none focus:ring-4 focus:ring-[#78a0ff]/15" />
            <button type="submit" disabled={busy} className="w-full rounded-xl bg-[#3d6fe0] px-3 py-3 text-sm font-semibold text-white transition hover:bg-[#14355e] disabled:opacity-60">{busy ? "Updating..." : "Update password"}</button>
          </form>
        )}
        <p className="mt-6 text-center text-sm text-white/70"><Link to="/login" className="font-medium text-[#a9c1ff] hover:text-white">Back to sign in</Link></p>
      </div>
    </div>
  );
}
