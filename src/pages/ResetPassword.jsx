import { useState } from "react";
import AuthShell, { Field, AuthError, AuthNote, PrimaryButton } from "../components/AuthShell";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { authApi } from "../lib/api";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    if (!token) return setError("This reset link is missing its token.");
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirm) return setError("Passwords do not match.");
    setBusy(true);
    try {
      await authApi.confirmPasswordReset({ token, password });
      setDone(true);
    } catch (err) {
      setError(err.message || "Could not reset password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      scene="reset"
      title={<>Choose a new <span className="serif-i text-violet">password.</span></>}
      subtitle="Use at least 8 characters."
      footer={<Link to="/login" className="font-medium text-midnight underline decoration-lemon decoration-[3px] underline-offset-4 hover:decoration-violet">Back to sign in</Link>}
    >
      <AuthError>{error}</AuthError>
      {done ? (
        <div className="space-y-5">
          <AuthNote>Your password has been updated.</AuthNote>
          <PrimaryButton type="button" onClick={() => navigate("/login", { replace: true })}>Back to sign in</PrimaryButton>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <Field label="New password">
            <input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="field" />
          </Field>
          <Field label="Confirm new password">
            <input type="password" required minLength={8} autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} className="field" />
          </Field>
          <PrimaryButton type="submit" disabled={busy}>{busy ? "Updating…" : "Update password"}</PrimaryButton>
        </form>
      )}
    </AuthShell>
  );
}
