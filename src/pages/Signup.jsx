import { useState } from "react";
import AuthShell, { Field, AuthError, PrimaryButton } from "../components/AuthShell";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
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
    <AuthShell
      scene="signup"
      title={<>Join your <span className="serif-i text-violet">department.</span></>}
      subtitle="Free for students. It takes about a minute."
      footer={<>Already have an account? <Link to="/login" className="font-medium text-midnight underline decoration-lemon decoration-[3px] underline-offset-4 hover:decoration-violet">Sign in</Link></>}
    >
      <AuthError>{error}</AuthError>
      <form onSubmit={handleSubmit} className="space-y-5">
        <Field label="Full name">
          <input value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" placeholder="As it appears on your ID card" className="field" />
        </Field>
        <Field label="Email">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" placeholder="you@example.com" className="field" />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Password">
            <div className="relative">
              <input type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete="new-password" className="field pr-12" />
              <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Hide password" : "Show password"} className="absolute right-4 top-1/2 -translate-y-1/2 text-midnight/45 transition hover:text-midnight">
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </Field>
          <Field label="Confirm password">
            <div className="relative">
              <input type={showC ? "text" : "password"} value={confirm} onChange={(e) => setConfirm(e.target.value)} required autoComplete="new-password" className="field pr-12" />
              <button type="button" onClick={() => setShowC((v) => !v)} aria-label={showC ? "Hide password" : "Show password"} className="absolute right-4 top-1/2 -translate-y-1/2 text-midnight/45 transition hover:text-midnight">
                {showC ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </Field>
        </div>
        <p className="text-[0.8rem] leading-relaxed text-midnight/50">At least 6 characters. By continuing you agree to our <Link to="/privacy" className="underline underline-offset-2">privacy policy</Link>.</p>
        <PrimaryButton type="submit" disabled={busy}>{busy ? "Creating your account…" : "Create account"}</PrimaryButton>
      </form>
    </AuthShell>
  );
}
