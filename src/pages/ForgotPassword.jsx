import { useState } from "react";
import { Link } from "react-router-dom";
import BrandLogo from "../components/BrandLogo";
import AuthAmbientBackground from "../components/AuthAmbientBackground";
import { friendlyAuthError } from "../lib/authErrors";
import { authApi } from "../lib/api";

const inputClass =
  "w-full rounded-lg border border-white/15 bg-white/10 px-3 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-teal-400 focus:outline-none";

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
      setError(friendlyAuthError(err.code) || err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <AuthAmbientBackground />

      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-white/15 bg-[#0b1220]/85 p-8 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl">
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
            <p className="rounded-lg border border-teal-400/30 bg-teal-500/15 px-3 py-3 text-sm text-teal-100">
              If an account exists for <strong className="text-white">{email}</strong>, a reset link
              has been sent. Check your inbox and spam folder.
            </p>
            <Link
              to="/login"
              className="block w-full rounded-lg bg-teal-500 px-3 py-2.5 text-center text-sm font-semibold text-white hover:bg-teal-400"
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
              className="w-full rounded-lg bg-teal-500 px-3 py-2.5 text-sm font-semibold text-white hover:bg-teal-400 disabled:opacity-60"
            >
              {busy ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-white/70">
          Remembered it?{" "}
          <Link to="/login" className="font-medium text-teal-300 hover:text-teal-200">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
