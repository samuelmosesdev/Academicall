import { useState } from "react";
import { X, Sparkles, Loader2, AlertCircle } from "lucide-react";
import { generateQuestionsFromPdf } from "../lib/geminiGenerate";
import { questionsApi, quizzesApi } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

const fieldClass =
  "w-full rounded-lg border border-border-light bg-card-light px-3 py-2 text-sm text-ink focus:border-teal focus:outline-none";

const MAX_QUESTIONS = 30;

export default function StudentGenerateQuizModal({
  open,
  onClose,
  material,
}) {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [count, setCount] = useState(10);
  const [difficulty, setDifficulty] = useState("medium");
  const [sectionNote, setSectionNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!open || !material) return null;

  async function handleGenerate() {
    setError("");
    if (!count || count < 1 || count > MAX_QUESTIONS) {
      return setError(`Choose between 1 and ${MAX_QUESTIONS} questions.`);
    }

    setBusy(true);
    try {
      let pool = [];
      try {
        const res = await quizzesApi.listMaterialQuestions(material.id);
        pool = res.questions || res || [];
      } catch {
        pool = [];
      }

      let selectedQuestions = [];

      if (Array.isArray(pool) && pool.length >= count) {
        const shuffled = [...pool].sort(() => Math.random() - 0.5);
        selectedQuestions = shuffled.slice(0, count);
      } else {
        const pdfSource =
          material.pdfFile || material.fileUrl || material.pdfUrl || material.url;
        if (!pdfSource) {
          throw new Error(
            "This material has no PDF attached for AI generation. Ask your Course Rep to re-upload with a file."
          );
        }

        let pdfFile = material.pdfFile;
        if (!pdfFile && typeof pdfSource === "string") {
          const resp = await fetch(pdfSource);
          if (!resp.ok) throw new Error("Could not download material PDF.");
          const blob = await resp.blob();
          pdfFile = new File(
            [blob],
            `${material.title || "material"}.pdf`,
            { type: "application/pdf" }
          );
        }

        const generated = await generateQuestionsFromPdf({
          pdfFile,
          count,
          difficulty,
          topic: sectionNote || material.title,
          courseCode: material.courseCode,
          courseTitle: material.courseTitle,
        });

        const saved = [];
        for (const q of generated) {
          const created = await questionsApi.create({
            courseCode: material.courseCode || "",
            courseTitle: material.courseTitle || "",
            faculty: material.faculty || "",
            department: material.department || "",
            level: material.level || "",
            topic: q.topic || sectionNote || material.title || "General",
            questionText: q.questionText,
            options: q.options,
            correctIndex: q.correctIndex,
            explanation: q.explanation || "",
            difficulty: q.difficulty || difficulty,
            materialId: material.id,
            generatedByUserId: user?.uid || profile?.id || null,
            source: "ai_material",
          });
          saved.push(created.question || created);
        }
        selectedQuestions = saved;
      }

      const quizRes = await quizzesApi.create({
        materialId: material.id,
        materialTitle: material.title,
        courseCode: material.courseCode,
        courseTitle: material.courseTitle,
        difficulty,
        questionCount: selectedQuestions.length,
        questionIds: selectedQuestions.map((q) => q.id).filter(Boolean),
        sectionNote: sectionNote || null,
        status: "ready",
      });

      const quizId = quizRes.id || quizRes.quiz?.id || "";
      onClose?.();
      navigate(`/dashboard/practice?quiz=${encodeURIComponent(quizId)}`);
    } catch (err) {
      setError(err.message || "Could not generate quiz.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border-light bg-card-light shadow-xl">
        <div className="flex items-center justify-between border-b border-border-light px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal/15 text-teal">
              <Sparkles size={16} />
            </span>
            <div>
              <h2 className="text-base font-semibold text-ink">Generate Quiz</h2>
              <p className="line-clamp-1 text-xs text-ink-muted">
                {material.title}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-ink-muted hover:bg-surface-light"
            disabled={busy}
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <p className="text-xs text-ink-muted">
            Questions are generated from this material, or reused from the shared
            pool when available. After generation you will be taken to Practice.
          </p>

          <div>
            <label className="mb-1 block text-xs text-ink-muted">
              Page / section focus (optional)
            </label>
            <input
              value={sectionNote}
              onChange={(e) => setSectionNote(e.target.value)}
              placeholder="e.g. Chapter 3, pages 12–20"
              className={fieldClass}
              disabled={busy}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-ink-muted">
                Questions (1–{MAX_QUESTIONS})
              </label>
              <input
                type="number"
                min={1}
                max={MAX_QUESTIONS}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className={fieldClass}
                disabled={busy}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-ink-muted">
                Difficulty
              </label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className={fieldClass}
                disabled={busy}
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="button"
            onClick={handleGenerate}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal px-4 py-3 text-sm font-semibold text-white hover:bg-teal-dark disabled:opacity-60"
          >
            {busy ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Sparkles size={16} />
                Generate & open in Practice
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}