import { useEffect, useRef, useState } from "react";
import AuthShell, { Field, AuthError, PrimaryButton, Divider } from "../components/AuthShell";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { friendlyAuthError } from "../lib/authErrors";
import { renderGoogleSignInButton } from "../lib/googleAuth";
import { twoFactorApi } from "../lib/api";

export default function Login() {
  const { loginWithApi, signInWithGoogle, completeTwoFactor } = useAuth();
  const [challenge, setChallenge] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const returnLocation = location.state?.from;
  const from = returnLocation
    ? `${returnLocation.pathname || ""}${returnLocation.search || ""}${returnLocation.hash || ""}`
    : undefined;

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
        const r = await signInWithGoogle(credential);
        if (r?.twoFactorRequired) { setChallenge(r); return; }
        navigate(from && from !== "/login" ? from : "/login-redirect", { replace: true });
      } catch (err) {
        setError(err.message || friendlyAuthError(err.code) || "Google sign-in didn't go through.");
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
        if (active) setError(err?.message || "Google sign-in is unavailable.");
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
      const r = await loginWithApi(identifier.trim(), password);
      if (r?.twoFactorRequired) { setChallenge(r); return; }
      navigate(from && from !== "/login" ? from : "/login-redirect", { replace: true });
    } catch (err) {
      setError(err.message || friendlyAuthError(err.code) || "Sign-in didn't go through.");
    } finally {
      setBusy(false);
    }
  }

  if (challenge) {
    return (
      <TwoFactorStep
        challenge={challenge}
        onBack={() => { setChallenge(null); setPassword(""); }}
        onRenew={setChallenge}
        onSubmit={async (code) => {
          await completeTwoFactor(challenge.challengeId, code);
          navigate(from && from !== "/login" ? from : "/login-redirect", { replace: true });
        }}
      />
    );
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

/** Second step of sign-in: a code from email or an authenticator app (or a backup code). */
function TwoFactorStep({ challenge, onSubmit, onBack, onRenew }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [useBackup, setUseBackup] = useState(false);
  const [resent, setResent] = useState(false);
  const isEmail = challenge.method === "email";

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await onSubmit(code.trim());
    } catch (err) {
      if (err.data?.code === "challenge_expired" || err.data?.code === "challenge_locked") {
        setError(err.message || "This sign-in code expired. Sign in again.");
        setTimeout(onBack, 2500);
      } else setError(err.message || "That code isn't right.");
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setError("");
    try {
      const r = await twoFactorApi.resend(challenge.challengeId);
      onRenew(r);
      setResent(true);
    } catch (err) {
      setError(err.message || "Could not send a new code.");
    }
  }

  return (
    <AuthShell
      scene="login"
      title={<>One more <span className="serif-i text-violet">step.</span></>}
      subtitle={useBackup
        ? "Enter one of the backup codes you saved when you set up two-step sign-in."
        : isEmail
          ? `We sent a 6-digit code to ${challenge.emailHint}. It expires in 10 minutes.`
          : "Open your authenticator app and enter the 6-digit code for Academicall."}
      footer={<button type="button" onClick={onBack} className="font-medium text-midnight underline decoration-lemon decoration-[3px] underline-offset-4 hover:decoration-violet">Use a different account</button>}
    >
      <AuthError>{error}</AuthError>
      <form onSubmit={submit} className="space-y-5">
        <Field label={useBackup ? "Backup code" : "Code"}>
          <input
            autoFocus
            inputMode={useBackup ? "text" : "numeric"}
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(useBackup ? e.target.value.slice(0, 9) : e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder={useBackup ? "abcd-efgh" : "123456"}
            className="field num tracking-[0.3em]"
            required
          />
        </Field>
        <PrimaryButton type="submit" disabled={busy || (useBackup ? code.replace(/-/g, "").length < 8 : code.length < 6)}>{busy ? "Checking?" : "Sign in"}</PrimaryButton>
      </form>
      <div className="mt-4 flex flex-wrap justify-between gap-2 text-[0.85rem]">
        {isEmail && !useBackup ? (
          <button type="button" onClick={resend} className="font-medium text-violet hover:underline">{resent ? "Sent again" : "Send a new code"}</button>
        ) : <span />}
        {!isEmail && (
          <button type="button" onClick={() => { setUseBackup((v) => !v); setCode(""); }} className="font-medium text-violet hover:underline">
            {useBackup ? "Use the authenticator app" : "Use a backup code"}
          </button>
        )}
      </div>
    </AuthShell>
  );
}
