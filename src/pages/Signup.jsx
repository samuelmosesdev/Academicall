import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, ArrowRight, Sparkles, ShieldCheck, BookOpen } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { friendlyAuthError } from "../lib/authErrors";
import BrandLogo from "../components/BrandLogo";
import AuthAmbientBackground from "../components/AuthAmbientBackground";

export default function Signup() {
  const { registerWithApi } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [showC, setShowC] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setBusy(true);
    try {
      await registerWithApi(email.trim(), password, name.trim());
      navigate("/verify-email", { replace: true });
    } catch (err) {
      console.error("Signup error:", err);
      setError(err.message || friendlyAuthError(err.code) || "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#060a14] px-4 py-10 text-[#101c30]">
      <AuthAmbientBackground />

      <div className="relative z-10 grid w-full max-w-6xl overflow-hidden rounded-[32px] border border-white/10 bg-white/5 p-4 shadow-[0_32px_100px_rgba(0,0,0,0.5)] backdrop-blur-xl lg:grid-cols-[1.08fr_0.92fr]">
        <div className="relative overflow-hidden rounded-[28px] bg-[#101f35] p-6 sm:p-8 lg:p-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(61,111,224,0.28),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(214,230,74,0.16),transparent_32%)]" />
          <div className="relative z-10 flex h-full flex-col justify-between gap-8">
            <div className="flex items-center justify-between">
              <BrandLogo size={38} textClass="text-white" className="drop-shadow-sm" />
              <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/80">
                New student
              </span>
            </div>

            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#d6e64a]/30 bg-[#d6e64a]/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#eaf6a4]">
                <Sparkles size={12} />
                Start smart
              </div>

              <h1 className="max-w-md text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Build a clearer path to your studies.
              </h1>
              <p className="max-w-md text-sm leading-7 text-white/75 sm:text-base">
                Join a guided academic experience that helps you stay organised, connected, and focused on what matters next.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { icon: BookOpen, label: "Personalised academic flow" },
                { icon: ShieldCheck, label: "Secure account management" },
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
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#3d6fe0]">Create account</p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-[#101c30]">Get started</h2>
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
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-[#3d4d5e]">Full name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full rounded-2xl border border-[#d9e1ec] bg-white px-4 py-3 text-sm text-[#101c30] outline-none transition focus:border-[#3d6fe0] focus:ring-4 focus:ring-[#3d6fe0]/10"
                placeholder="Jane Doe"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-[#3d4d5e]">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
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

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-[#3d4d5e]">Confirm password</label>
              <div className="relative">
                <input
                  type={showC ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  className="w-full rounded-2xl border border-[#d9e1ec] bg-white px-4 py-3 pr-11 text-sm text-[#101c30] outline-none transition focus:border-[#3d6fe0] focus:ring-4 focus:ring-[#3d6fe0]/10"
                  placeholder="Repeat password"
                />
                <button
                  type="button"
                  onClick={() => setShowC((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-[#53657d] transition hover:bg-[#edf3ff] hover:text-[#14355e]"
                  aria-label={showC ? "Hide password" : "Show password"}
                >
                  {showC ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#3d6fe0] px-4 py-3.5 text-sm font-semibold text-white shadow-[0_16px_32px_rgba(61,111,224,0.25)] transition hover:bg-[#14355e] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {busy ? "Creating…" : "Create account"}
              <ArrowRight size={16} />
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-[#53657d]">
            Already have an account?{' '}
            <Link to="/login" className="font-bold text-[#14355e] transition hover:text-[#3d6fe0]">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}