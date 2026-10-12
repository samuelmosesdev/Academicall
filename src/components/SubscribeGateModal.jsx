import { Crown, Lock, X, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";

/**
 * Beautiful lock popup for Free users hitting Pro-only features (e.g. Timetable).
 */
export default function SubscribeGateModal({ open, onClose, feature = "this feature" }) {
  const navigate = useNavigate();
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-midnight/55 backdrop-blur-[3px]"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-border-light bg-card-light shadow-2xl">
        <div className="bg-gradient-to-br from-[#0F0326] via-[#2F33B8] to-[#454ADE] px-6 pb-10 pt-6 text-white">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full bg-white/15 p-1.5 text-white hover:bg-white/25"
          >
            <X size={16} />
          </button>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
            <Lock size={28} />
          </div>
          <h2 className="text-center text-xl font-bold">Subscribe to unlock</h2>
          <p className="mt-2 text-center text-sm text-white/85">
            <span className="font-medium capitalize">{feature}</span> is a Pro feature. Upgrade to
            open the full timetable, unlimited practice, and every course material.
          </p>
        </div>

        <div className="-mt-5 space-y-3 px-6 pb-6">
          <div className="rounded-2xl border border-border-light bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              <Sparkles size={16} className="text-teal" />
              From ₦500 / week · ₦4,000 / year
            </div>
            <p className="mt-1 text-xs text-ink-muted">
              Pay on Paystack. Your Pro access is activated after payment is confirmed.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              onClose?.();
              navigate("/dashboard/upgrade");
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal px-4 py-3.5 text-sm font-semibold text-white shadow-md hover:bg-teal-dark"
          >
            <Crown size={16} />
            View plans & subscribe
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl border border-border-light px-4 py-2.5 text-sm font-medium text-ink-muted hover:bg-surface-light"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
