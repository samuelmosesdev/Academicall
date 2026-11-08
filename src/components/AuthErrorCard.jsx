import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, Clock3, Info, WifiOff, X } from "lucide-react";
import { describeAuthError } from "../lib/authErrors";
import "../styles/auth-error.css";

const ICONS = {
  network: WifiOff,
  timeout: Clock3,
  tooManyRequests: Clock3,
};
const TONE_ICON = { error: AlertCircle, warn: AlertCircle, info: Info };

/**
 * Soft tinted card for sign-in / sign-up problems.
 * `error` may be a described error object, an Error, or a plain string.
 */
export default function AuthErrorCard({ error, onDismiss, className = "" }) {
  const info = describeAuthError(error);
  const ref = useRef(null);

  // role="alert" announces it; on phones the form can be below the fold, so bring the card into view.
  useEffect(() => {
    if (info && ref.current?.scrollIntoView) ref.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [info?.kind, info?.message]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!info) return null;
  const Icon = ICONS[info.kind] || TONE_ICON[info.tone] || AlertCircle;

  return (
    <div
      ref={ref}
      role="alert"
      aria-live="assertive"
      className={`auth-err auth-err-${info.tone || "error"} ${className}`}
    >
      <span className="auth-err-icon" aria-hidden="true"><Icon size={17} strokeWidth={2.1} /></span>
      <div className="min-w-0 flex-1">
        <p className="auth-err-title">{info.title}</p>
        <p className="auth-err-msg">{info.message}</p>
        {info.action && (
          <Link to={info.action.to} className="auth-err-action">{info.action.label} →</Link>
        )}
      </div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Dismiss message" className="auth-err-close">
          <X size={16} />
        </button>
      )}
    </div>
  );
}
