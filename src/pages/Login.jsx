import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { GraduationCap, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { friendlyAuthError } from "../lib/authErrors";
import GoogleIcon from "../components/GoogleIcon";

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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f7faf6] px-4">
      <div className="pointer-events-none absolute -left-20 top-0 h-80 w-80 rounded-full bg-[#a6f2cf]/40 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 bottom-10 h-72 w-72 rounded-full bg-[#c3e8ff]/50 blur-3xl" />

      <div className="relative w-full max-w-md rounded-3xl border border-white/60 bg-white/80 p-8 shadow-xl shadow-[#00668a]/08 backdrop-blur-xl">
        <Link to="/" className="mb-6 flex items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#005239] text-white">
            <GraduationCap size={20} />
          </span>
          <span className="text-lg font-extrabold text-[#005239]">Academicall</span>
        </Link>

        <h1 className="text-2xl font-bold tracking-tight text-[#181c1a]">Welcome back</h1>
        <p className="mt-1 text-sm text-[#3f4943]">Sign in to continue your journey.</p>

        {error && (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#3f4943]">Email or Unique ID</label>
            <input
              type="text"
              autoComplete="username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              className="w-full rounded-xl border border-[#bec9c2] bg-white px-3 py-2.5 text-sm text-[#181c1a] outline-none focus:border-[#005239] focus:ring-2 focus:ring-[#005239]/15"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#3f4943]">Password</label>
            <div className="relative">
              <input
                type={show ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-xl border border-[#bec9c2] bg-white px-3 py-2.5 pr-10 text-sm outline-none focus:border-[#005239] focus:ring-2 focus:ring-[#005239]/15"
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6f7973]"
              >
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div className="flex justify-end">
            <Link to="/forgot-password" className="text-xs font-semibold text-[#00668a] hover:underline">
              Forgot password?
            </Link>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full bg-[#fb923c] py-3 text-sm font-bold text-white shadow-md shadow-orange-500/25 hover:opacity-95 disabled:opacity-60"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-[#e0e3df]" />
          <span className="text-xs text-[#6f7973]">or</span>
          <div className="h-px flex-1 bg-[#e0e3df]" />
        </div>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-full border border-[#bec9c2] bg-white py-2.5 text-sm font-semibold text-[#181c1a] hover:bg-[#f1f4f0] disabled:opacity-60"
        >
          <GoogleIcon /> Continue with Google
        </button>

        <p className="mt-6 text-center text-sm text-[#3f4943]">
          New here?{" "}
          <Link to="/signup" className="font-bold text-[#005239] hover:underline">
            Create account
          </Link>
        </p>
      </div>
    </div>
  );
}