import { useState } from "react";
import {
  X,
  Sparkles,
  Loader2,
  Check,
  AlertCircle,
  FileText,
} from "lucide-react";
import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  updateDoc,
  increment,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { generateQuestionsFromDocument } from "../lib/geminiGenerate";
import { refreshCbtQuestions } from "../hooks/useCbtData";

const fieldClass =
  "w-full rounded-lg border border-border-subtle bg-bg-panel px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none";

export default function AiGenerateFromDocumentModal({
  open,
  onClose,
  document: docItem,
}) {
  const [easy, setEasy] = useState(10);
  const [medium, setMedium] = useState(15);
  const [hard, setHard] = useState(10);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [doneCount, setDoneCount] = useState(null);

  if (!open || !docItem) return null;

  const total =
    (Number(easy) || 0) + (Number(medium) || 0) + (Number(hard) || 0);

  async function handleGenerate() {
    setError("");
    setDoneCount(null);
    if (total < 1) return setError("Set at least 1 question across difficulties.");
    if (total > 60) return setError("Max 60 questions per run (free-tier friendly).");

    setGenerating(true);
    try {
      const list = await generateQuestionsFromDocument({
        pdfUrl: docItem.fileUrl,
        fileName: docItem.fileName || `${docItem.title}.pdf`,
        byDifficulty: {
          easy: Number(easy) || 0,
          medium: Number(medium) || 0,
          hard: Number(hard) || 0,
        },
        documentTitle: docItem.title,
      });

      setSaving(true);
      let saved = 0;
      for (const q of list) {
        await addDoc(collection(db, "cbtQuestions"), {
          documentId: docItem.id,
          documentTitle: docItem.title || "",
          faculty: docItem.faculty || null,
          level: docItem.level || null,
          courseCode: null,
          courseTitle: docItem.title || "",
          topic: q.topic || docItem.title || "General",
          questionText: q.questionText,
          options: q.options,
          correctIndex: q.correctIndex,
          explanation: q.explanation || "",
          difficulty: q.difficulty || "medium",
          source: "document-ai",
          createdAt: serverTimestamp(),
        });
        saved += 1;
      }
      await refreshCbtQuestions();

      const easyN = list.filter((q) => q.difficulty === "easy").length;
      const medN = list.filter((q) => q.difficulty === "medium").length;
      const hardN = list.filter((q) => q.difficulty === "hard").length;

      await updateDoc(doc(db, "documents", docItem.id), {
        questionCount: increment(saved),
        easyQuestionCount: increment(easyN),
        mediumQuestionCount: increment(medN),
        hardQuestionCount: increment(hardN),
        lastAiGeneratedAt: serverTimestamp(),
      });

      setDoneCount(saved);
    } catch (err) {
      setError(err.message || "Generation failed.");
    } finally {
      setGenerating(false);
      setSaving(false);
    }
  }

  function handleClose() {
    setError("");
    setDoneCount(null);
    onClose?.();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border-subtle bg-bg-panel shadow-2xl">
        <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-soft text-accent">
              <Sparkles size={16} />
            </span>
            <div>
              <h2 className="text-base font-semibold text-text-primary">
                AI questions from material
              </h2>
              <p className="line-clamp-1 text-xs text-text-muted">{docItem.title}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-2 text-text-muted hover:bg-bg-elevated"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="flex items-start gap-2 rounded-lg bg-bg-elevated/60 px-3 py-2 text-xs text-text-secondary">
            <FileText size={14} className="mt-0.5 shrink-0 text-accent" />
            Gemini will read this PDF and create MCQs with answers & explanations.
            Students can then practise from this material.
          </div>

          <p className="text-sm font-medium text-text-primary">
            How many questions per difficulty?
          </p>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs text-text-muted">Easy</label>
              <input
                type="number"
                min={0}
                max={30}
                value={easy}
                onChange={(e) => setEasy(e.target.value)}
                className={fieldClass}
                disabled={generating || saving}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-text-muted">Medium</label>
              <input
                type="number"
                min={0}
                max={30}
                value={medium}
                onChange={(e) => setMedium(e.target.value)}
                className={fieldClass}
                disabled={generating || saving}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-text-muted">Hard</label>
              <input
                type="number"
                min={0}
                max={30}
                value={hard}
                onChange={(e) => setHard(e.target.value)}
                className={fieldClass}
                disabled={generating || saving}
              />
            </div>
          </div>

          <p className="text-xs text-text-muted">
            Total this run:{" "}
            <strong className="text-text-primary">{total}</strong>
            {docItem.questionCount ? (
              <> · Already in bank: {docItem.questionCount}</>
            ) : null}
            . Aim for 100+ per material over multiple runs.
          </p>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-sm text-status-danger">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          {doneCount != null && (
            <div className="flex items-center gap-2 rounded-lg border border-accent/30 bg-accent-soft px-3 py-2 text-sm text-accent">
              <Check size={16} />
              Saved {doneCount} questions to this material.
            </div>
          )}

          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating || saving || total < 1}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-bg-app hover:bg-accent-strong disabled:opacity-60"
          >
            {generating || saving ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {saving ? "Saving to question bank…" : "Gemini is generating…"}
              </>
            ) : (
              <>
                <Sparkles size={16} />
                Generate {total} questions
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}