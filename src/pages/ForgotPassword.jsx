import { useState } from "react";
import AuthShell, { Field, AuthError, AuthNote, PrimaryButton } from "../components/AuthShell";
import { Link } from "react-router-dom";
import { friendlyAuthError } from "../lib/authErrors";
import { authApi } from "../lib/api";

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
      setError(err.message || friendlyAuthError(err.code) || "Could not send reset email.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      scene="reset"
      title={<>Reset your <span className="serif-i text-violet">password.</span></>}
      subtitle="Enter the email on your account and we'll send you a reset link."
      footer={<>Remembered it? <Link to="/login" className="font-medium text-midnight underline decoration-lemon decoration-[3px] underline-offset-4 hover:decoration-violet">Sign in</Link></>}
    >
      <AuthError>{error}</AuthError>
      {sent ? (
        <div className="space-y-5">
          <AuthNote>If an account exists for <strong>{email}</strong>, a reset link is on its way. Check your inbox and spam folder.</AuthNote>
          <Link to="/login" className="block w-full rounded-full bg-midnight py-4 text-center text-[0.95rem] font-medium text-white hover:bg-midnight-2">Back to sign in</Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <Field label="Email">
            <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="field" placeholder="you@example.com" />
          </Field>
          <PrimaryButton type="submit" disabled={busy}>{busy ? "Sending…" : "Send reset link"}</PrimaryButton>
        </form>
      )}
    </AuthShell>
  );
}
