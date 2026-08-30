import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MailCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const RESEND_COOLDOWN = 45; // seconds
const POLL_INTERVAL = 4000; // ms — checks silently in the background

export default function VerifyEmail() {
  const { user, profile, resendVerificationEmail, refreshEmailVerified } = useAuth();
  const navigate = useNavigate();

  const [error, setError] = useState("");
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const pollRef = useRef(null);

  useEffect(() => {
    if (profile?.emailVerified) {
      navigate("/complete-profile", { replace: true });
      return undefined;
    }
    pollRef.current = setInterval(async () => {
      const verified = await refreshEmailVerified().catch(() => false);
      if (verified) {
        clearInterval(pollRef.current);
        navigate("/complete-profile", { replace: true });
      }
    }, POLL_INTERVAL);
    return () => clearInterval(pollRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.emailVerified, navigate, refreshEmailVerified]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  if (profile?.emailVerified) return null;

  async function handleResend() {
    setError("");
    setResending(true);
    try {
      await resendVerificationEmail();
      setCooldown(RESEND_COOLDOWN);
    } catch (err) {
      setError(
        err.code === "auth/too-many-requests"
          ? "Please wait a bit before requesting another link."
          : err.message
      );
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-app px-4">
      <div className="w-full max-w-sm rounded-xl border border-border-subtle bg-bg-panel p-8 text-center">
        <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent">
          <MailCheck size={22} />
        </span>
        <h1 className="mb-1 text-xl font-semibold text-text-primary">Verify your email</h1>
        <p className="mb-6 text-sm text-text-secondary">
          A link has been sent to <span className="text-text-primary">{user?.email}</span>.
          Click it to verify — this page will update automatically.
        </p>

        {error && (
          <p className="mb-4 rounded-lg border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-sm text-status-danger">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={handleResend}
          disabled={resending || cooldown > 0}
          className="text-sm font-medium text-accent hover:underline disabled:cursor-not-allowed disabled:text-text-muted disabled:no-underline"
        >
          {cooldown > 0 ? `Resend link in ${cooldown}s` : resending ? "Sending…" : "Resend link"}
        </button>
      </div>
    </div>
  );
}