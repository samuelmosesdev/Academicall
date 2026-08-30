import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MailCheck, Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { isBrevoVerifyConfigured } from "../lib/brevoVerify";

const RESEND_COOLDOWN = 45;
const POLL_INTERVAL = 4000;

export default function VerifyEmail() {
  const {
    user,
    profile,
    resendVerificationEmail,
    refreshEmailVerified,
    verifyEmailWithCode,
    authMode,
  } = useAuth();
  const navigate = useNavigate();
  const useBrevo = authMode === "api" || isBrevoVerifyConfigured();

  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [resending, setResending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [code, setCode] = useState("");
  const pollRef = useRef(null);

  const alreadyVerified = profile?.emailVerified === true;

  // Navigating during render (and returning early, above the hooks below) meant
  // this component rendered a different number of hooks on the verifying render
  // than on every other one. Redirect from an effect instead.
  useEffect(() => {
    if (alreadyVerified) navigate("/complete-profile", { replace: true });
  }, [alreadyVerified, navigate]);

  useEffect(() => {
    if (alreadyVerified) return;
    pollRef.current = setInterval(async () => {
      const verified = await refreshEmailVerified().catch(() => false);
      if (verified) {
        clearInterval(pollRef.current);
        navigate("/complete-profile", { replace: true });
      }
    }, POLL_INTERVAL);
    return () => clearInterval(pollRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alreadyVerified]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function handleResend() {
    setError("");
    setMsg("");
    setResending(true);
    try {
      await resendVerificationEmail();
      setCooldown(RESEND_COOLDOWN);
      setMsg(
        useBrevo
          ? "A new code was sent. Check inbox and spam."
          : "A new link was sent. Check inbox and spam."
      );
    } catch (err) {
      setError(
        err.code === "auth/too-many-requests"
          ? "Please wait a bit before requesting another code."
          : err.message || "Could not resend"
      );
    } finally {
      setResending(false);
    }
  }

  async function handleVerifyCode(e) {
    e.preventDefault();
    setError("");
    setMsg("");
    const trimmed = code.trim();
    if (!/^\d{6}$/.test(trimmed)) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    setVerifying(true);
    try {
      await verifyEmailWithCode(trimmed);
      setMsg("Email verified. Continuing…");
      navigate("/complete-profile", { replace: true });
    } catch (err) {
      setError(err.message || "Invalid or expired code");
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-app px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border-subtle bg-bg-panel p-8 text-center">
        <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent">
          <MailCheck size={22} />
        </span>
        <h1 className="mb-1 font-display text-xl font-semibold text-text-primary">
          Verify your email
        </h1>
        <p className="mb-3 text-sm text-text-secondary">
          {useBrevo ? (
            <>
              We sent a <strong className="text-text-primary">6-digit code</strong> from{" "}
              <strong className="text-text-primary">Academicall</strong> to{" "}
              <span className="font-medium text-text-primary">{user?.email}</span>.
            </>
          ) : (
            <>
              A verification link was sent to{" "}
              <span className="font-medium text-text-primary">{user?.email}</span>.
            </>
          )}
        </p>
        <p className="mb-6 rounded-xl border border-border-subtle bg-bg-panel-alt px-3 py-2.5 text-left text-[12px] leading-relaxed text-text-muted">
          <strong className="text-text-secondary">Not in inbox?</strong> Check{" "}
          <strong>Spam / Junk / Promotions</strong>, then mark it as Not spam.
        </p>

        {useBrevo && (
          <form onSubmit={handleVerifyCode} className="mb-4 space-y-3 text-left">
            <label className="block text-xs font-medium text-text-muted">
              Verification code
            </label>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="w-full rounded-xl border border-border-subtle bg-bg-app px-3 py-3 text-center text-lg font-semibold tracking-[0.35em] text-text-primary focus:border-accent focus:outline-none"
            />
            <button
              type="submit"
              disabled={verifying || code.length !== 6}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-bg-app disabled:opacity-60"
            >
              {verifying ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Verifying…
                </>
              ) : (
                "Verify code"
              )}
            </button>
          </form>
        )}

        {error && (
          <p className="mb-3 rounded-lg border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-sm text-status-danger">
            {error}
          </p>
        )}
        {msg && (
          <p className="mb-3 text-sm text-accent">{msg}</p>
        )}

        <button
          type="button"
          onClick={handleResend}
          disabled={resending || cooldown > 0}
          className="text-sm font-medium text-accent hover:underline disabled:cursor-not-allowed disabled:text-text-muted disabled:no-underline"
        >
          {cooldown > 0
            ? `Resend in ${cooldown}s`
            : resending
              ? "Sending…"
              : useBrevo
                ? "Resend code"
                : "Resend link"}
        </button>
      </div>
    </div>
  );
}
