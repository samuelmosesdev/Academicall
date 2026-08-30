import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { GraduationCap, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { friendlyAuthError } from "../lib/authErrors";

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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f7faf6] px-4 py-10">
      <div className="pointer-events-none absolute right-0 top-0 h-96 w-96 rounded-full bg-[#a6f2cf]/35 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-80 w-80 rounded-full bg-[#ffdcc5]/40 blur-3xl" />

      <div className="relative w-full max-w-md rounded-3xl border border-white/60 bg-white/85 p-8 shadow-xl shadow-[#005239]/08 backdrop-blur-xl">
        <Link to="/" className="mb-6 flex items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#005239] text-white">
            <GraduationCap size={20} />
          </span>
          <span className="text-lg font-extrabold text-[#005239]">Academicall</span>
        </Link>

        <h1 className="text-2xl font-bold tracking-tight text-[#181c1a]">Create your account</h1>
        <p className="mt-1 text-sm text-[#3f4943]">Join students elevating their academic journey.</p>

        {error && (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-3.5">
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#3f4943]">Full name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded-xl border border-[#bec9c2] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#005239] focus:ring-2 focus:ring-[#005239]/15"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-[#3f4943]">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-xl border border-[#bec9c2] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#005239] focus:ring-2 focus:ring-[#005239]/15"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-[#3f4943]">Password</label>
            <div className="relative">
              <input
                type={show ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
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

          <div>
            <label className="mb-1 block text-xs font-semibold text-[#3f4943]">Confirm password</label>
            <div className="relative">
              <input
                type={showC ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                className="w-full rounded-xl border border-[#bec9c2] bg-white px-3 py-2.5 pr-10 text-sm outline-none focus:border-[#005239] focus:ring-2 focus:ring-[#005239]/15"
              />
              <button
                type="button"
                onClick={() => setShowC((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6f7973]"
              >
                {showC ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="mt-2 w-full rounded-full bg-[#fb923c] py-3 text-sm font-bold text-white shadow-md shadow-orange-500/25 hover:opacity-95 disabled:opacity-60"
          >
            {busy ? "Creating…" : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[#3f4943]">
          Already have an account?{" "}
          <Link to="/login" className="font-bold text-[#005239] hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}