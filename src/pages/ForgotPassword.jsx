import { useState } from "react";
import { Link } from "react-router-dom";
import BrandLogo from "../components/BrandLogo";
import AuthAmbientBackground from "../components/AuthAmbientBackground";
import { friendlyAuthError } from "../lib/authErrors";
import { authApi } from "../lib/api";

const inputClass =
  "w-full rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-[#78a0ff] focus:outline-none focus:ring-4 focus:ring-[#78a0ff]/15";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await authApi.requestPasswordReset({ email: email.trim() });
      setSent(true);
    } catch (err) {
      setError(err.message || friendlyAuthError(err.code) || "Could not send reset email.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <AuthAmbientBackground />

      <div className="animate-stitch-in relative z-10 w-full max-w-sm rounded-2xl border border-white/15 bg-[#0b1220]/85 p-8 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl">
        <div className="mb-6">
          <BrandLogo size={40} textClass="text-white" />
        </div>

        <h1 className="mb-1 text-xl font-semibold text-white">Reset password</h1>
        <p className="mb-6 text-sm text-white/70">
          Enter the email on your account. We&apos;ll send a reset link.
        </p>

        {error && (
          <p className="mb-4 rounded-lg border border-red-400/40 bg-red-500/15 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        )}

        {sent ? (
          <div className="space-y-4">
            <p className="rounded-xl border border-[#78a0ff]/30 bg-[#3d6fe0]/15 px-3 py-3 text-sm text-[#dce7ff]">
              If an account exists for <strong className="text-white">{email}</strong>, a reset link
              has been sent. Check your inbox and spam folder.
            </p>
            <Link
              to="/login"
              className="block w-full rounded-xl bg-[#3d6fe0] px-3 py-3 text-center text-sm font-semibold text-white transition hover:bg-[#14355e]"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-white/80">Email</label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                placeholder="you@example.com"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-[#3d6fe0] px-3 py-3 text-sm font-semibold text-white transition hover:bg-[#14355e] disabled:opacity-60"
            >
              {busy ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-white/70">
          Remembered it?{" "}
          <Link to="/login" className="font-medium text-[#a9c1ff] hover:text-white">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
