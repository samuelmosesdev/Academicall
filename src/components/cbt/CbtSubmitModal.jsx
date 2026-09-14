import { AlertTriangle } from "lucide-react";

export default function CbtSubmitModal({
  open,
  onClose,
  onConfirm,
  stats,
  timeLeft,
  courseLabel,
  total,
}) {
  if (!open) return null;

  const mins = timeLeft != null ? Math.floor(timeLeft / 60) : null;
  const secs = timeLeft != null ? timeLeft % 60 : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#263143]/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600">
            <AlertTriangle size={22} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-[#111c2d]">Submit Examination?</h3>
            <p className="text-xs text-[#44474c]">{courseLabel}</p>
          </div>
        </div>

        <div className="mb-4 space-y-2 rounded-lg bg-[#f0f3ff] p-4 text-sm">
          <div className="flex justify-between">
            <span className="text-[#44474c]">Questions Answered</span>
            <strong>
              {stats.answered} / {total}
            </strong>
          </div>
          <div className="flex justify-between">
            <span className="text-[#44474c]">Flagged for Review</span>
            <strong className="text-amber-600">{stats.flagged} questions</strong>
          </div>
          <div className="flex justify-between">
            <span className="text-[#44474c]">Unattempted</span>
            <strong className="text-red-600">{stats.unattempted} questions</strong>
          </div>
          {timeLeft != null && (
            <div className="flex justify-between">
              <span className="text-[#44474c]">Time Remaining</span>
              <strong className="font-mono">
                {mins}m {String(secs).padStart(2, "0")}s
              </strong>
            </div>
          )}
        </div>

        <p className="mb-5 text-sm text-[#44474c]">
          Once submitted, your score and explanations will be shown. You cannot change answers.
        </p>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-[#e7eeff] px-4 py-2 text-sm font-medium text-[#111c2d] hover:bg-[#d8e3fb]"
          >
            Return to Exam
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            Confirm Submission
          </button>
        </div>
      </div>
    </div>
  );
}