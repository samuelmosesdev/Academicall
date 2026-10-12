import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Eye, EyeOff, ArrowRight, ShieldCheck, School, Sparkles } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { friendlyAuthError } from "../lib/authErrors";
import GoogleIcon from "../components/GoogleIcon";
import BrandLogo from "../components/BrandLogo";
import AuthAmbientBackground from "../components/AuthAmbientBackground";

export default function Login() {
  const { loginWithApi, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname;

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await loginWithApi(identifier.trim(), password);
      navigate(from && from !== "/login" ? from : "/login-redirect", { replace: true });
    } catch (err) {
      setError(err.message || friendlyAuthError(err.code) || "Login failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setError("");
    setBusy(true);
    try {
      await signInWithGoogle();
      navigate(from && from !== "/login" ? from : "/login-redirect", { replace: true });
    } catch (err) {
      setError(err.message || friendlyAuthError(err.code) || "Google sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#060a14] px-4 py-10 text-[#101c30]">
      <AuthAmbientBackground />

      <div className="relative z-10 grid w-full max-w-6xl overflow-hidden rounded-[32px] border border-white/10 bg-white/5 p-4 shadow-[0_32px_100px_rgba(0,0,0,0.5)] backdrop-blur-xl lg:grid-cols-[1.08fr_0.92fr]">
        <div className="relative overflow-hidden rounded-[28px] bg-[#0d1a2b] p-6 sm:p-8 lg:p-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(61,111,224,0.28),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(214,230,74,0.18),transparent_32%)]" />
          <div className="relative z-10 flex h-full flex-col justify-between gap-8">
            <div className="flex items-center justify-between">
              <BrandLogo size={38} textClass="text-white" className="drop-shadow-sm" />
              <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/80">
                Student portal
              </span>
            </div>

            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#d6e64a]/30 bg-[#d6e64a]/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#eaf6a4]">
                <Sparkles size={12} />
                Learning. Managed.
              </div>

              <h1 className="max-w-md text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Welcome back to your academic hub.
              </h1>
              <p className="max-w-md text-sm leading-7 text-white/75 sm:text-base">
                Continue with your coursework, department updates, reading materials, and next-step guidance in one place.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { icon: School, label: "Faculty-ready workflows" },
                { icon: ShieldCheck, label: "Secure, role-aware access" },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[#3d6fe0]/20 text-[#dfe9ff]">
                    <Icon size={18} />
                  </div>
                  <p className="text-sm font-medium text-white">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-[28px] bg-[#f4f7fb] p-6 sm:p-8 lg:p-10">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#3d6fe0]">Sign in</p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-[#101c30]">Welcome back</h2>
            </div>
            <Link to="/" className="rounded-full border border-[#14355e]/10 bg-white px-3 py-1.5 text-xs font-semibold text-[#14355e] transition hover:border-[#14355e]/20 hover:bg-[#ebf2ff]">
              Back home
            </Link>
          </div>

          {error && (
            <p className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
              {error}
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-[#3d4d5e]">Email or Unique ID</label>
              <input
                type="text"
                autoComplete="username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                className="w-full rounded-2xl border border-[#d9e1ec] bg-white px-4 py-3 text-sm text-[#101c30] outline-none transition focus:border-[#3d6fe0] focus:ring-4 focus:ring-[#3d6fe0]/10"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-[#3d4d5e]">Password</label>
              <div className="relative">
                <input
                  type={show ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full rounded-2xl border border-[#d9e1ec] bg-white px-4 py-3 pr-11 text-sm text-[#101c30] outline-none transition focus:border-[#3d6fe0] focus:ring-4 focus:ring-[#3d6fe0]/10"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-[#53657d] transition hover:bg-[#edf3ff] hover:text-[#14355e]"
                  aria-label={show ? "Hide password" : "Show password"}
                >
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end">
              <Link to="/forgot-password" className="text-sm font-medium text-[#3d6fe0] transition hover:text-[#14355e]">
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#3d6fe0] px-4 py-3.5 text-sm font-semibold text-white shadow-[0_16px_32px_rgba(61,111,224,0.25)] transition hover:bg-[#14355e] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {busy ? "Signing in…" : "Sign in"}
              <ArrowRight size={16} />
            </button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-[#dfe7f2]" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#617286]">or</span>
            <div className="h-px flex-1 bg-[#dfe7f2]" />
          </div>

          <button
            type="button"
            onClick={handleGoogle}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[#ccd8e8] bg-white px-4 py-3 text-sm font-semibold text-[#101c30] transition hover:bg-[#edf4ff] disabled:cursor-not-allowed disabled:opacity-70"
          >
            <GoogleIcon />
            Continue with Google
          </button>

          <p className="mt-6 text-center text-sm text-[#53657d]">
            New here?{' '}
            <Link to="/signup" className="font-bold text-[#14355e] transition hover:text-[#3d6fe0]">
              Create account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}