import { useEffect, useRef, useState } from "react";
import AuthShell, { Field, AuthError, PrimaryButton, Divider } from "../components/AuthShell";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { friendlyAuthError } from "../lib/authErrors";
import { renderGoogleSignInButton } from "../lib/googleAuth";

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
  const googleButtonRef = useRef(null);
  const googleBusyRef = useRef(false);

  useEffect(() => {
    let active = true;
    let cleanup = () => {};

    renderGoogleSignInButton(googleButtonRef.current, async (credential) => {
      if (!active || googleBusyRef.current) return;
      googleBusyRef.current = true;
      setError("");
      setBusy(true);
      try {
        await signInWithGoogle(credential);
        navigate(from && from !== "/login" ? from : "/login-redirect", { replace: true });
      } catch (err) {
        setError(err.message || friendlyAuthError(err.code) || "Google sign-in failed");
      } finally {
        googleBusyRef.current = false;
        if (active) setBusy(false);
      }
    }, () => active)
      .then((dispose) => {
        if (active) cleanup = dispose;
        else dispose();
      })
      .catch((err) => {
        if (active) setError(err.message || "Google sign-in is unavailable. Please try again.");
      });

    return () => {
      active = false;
      cleanup();
    };
  }, [from, navigate, signInWithGoogle]);

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

  return (
    <AuthShell
      scene="login"
      title={<>Welcome <span className="serif-i text-violet">back.</span></>}
      subtitle="Sign in to see today's classes and pick up your reading."
      footer={<>New to Academicall? <Link to="/signup" className="font-medium text-midnight underline decoration-lemon decoration-[3px] underline-offset-4 hover:decoration-violet">Create an account</Link></>}
    >
      <AuthError>{error}</AuthError>
      <div
        ref={googleButtonRef}
        aria-label="Continue with Google"
        className={`flex min-h-11 justify-center transition-opacity ${busy ? "pointer-events-none opacity-60" : ""}`}
      />
      <Divider />
      <form onSubmit={handleSubmit} className="space-y-5">
        <Field label="Email or Unique ID">
          <input type="text" autoComplete="username" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required placeholder="you@example.com" className="field" />
        </Field>
        <Field label="Password" action={<Link to="/forgot-password" className="text-[0.8rem] font-medium text-violet hover:underline">Forgot?</Link>}>
          <div className="relative">
            <input type={show ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required className="field pr-12" />
            <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Hide password" : "Show password"} className="absolute right-4 top-1/2 -translate-y-1/2 text-midnight/45 transition hover:text-midnight">
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
          </div>
        </Field>
        <PrimaryButton type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</PrimaryButton>
      </form>
    </AuthShell>
  );
}
