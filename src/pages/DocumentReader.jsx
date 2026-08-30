import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Crown,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  Sparkles,
  X,
} from "lucide-react";
import { documentsApi } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { recordMaterialOpen, recordDailyActivity } from "../lib/activity";
import { isPro } from "../lib/subscription";
import { withDownloadFlag } from "../lib/cloudinaryUpload";
import { generateQuestionsFromDocument } from "../lib/geminiGenerate";
import { isNativeApp } from "../lib/platform";
import {
  isOfflineAvailable,
  saveMaterialOffline,
  removeMaterialOffline,
  getOfflineObjectUrl,
} from "../lib/offlineMaterials";

function getExtension(name = "", url = "") {
  const source = name || url;
  const match = source.split("?")[0].match(/\.([a-zA-Z0-9]+)$/);
  return match ? match[1].toLowerCase() : "";
}

function useDocumentRecord(docId) {
  const { authMode } = useAuth();
  const [record, setRecord] = useState(undefined);
  useEffect(() => {
    if (!docId) return;
    setRecord(undefined);
    let alive = true;
    documentsApi.get(docId)
      .then(({ document }) => alive && setRecord(document || null))
      .catch(() => alive && setRecord(null));
    return () => { alive = false; };
  }, [docId]);
  return record;
}

const field =
  "w-full rounded-xl border border-border-light bg-card-light px-3 py-2 text-sm text-ink focus:border-teal focus:outline-none";

export default function DocumentReader() {
  const { docId } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const pro = isPro(profile);
  const item = useDocumentRecord(docId);

  // Count material opens + daily streak when reader opens
  useEffect(() => {
    if (user && docId) {
      recordMaterialOpen(user, docId, profile);
      if (profile) recordDailyActivity(user, profile);
    }
  }, [user?.uid, docId]);

  // App only: detect offline copy & prefer local blob when online file blocked
  useEffect(() => {
    let revoked = null;
    let cancelled = false;
    async function check() {
      if (!native || !docId || docId === "external") {
        setOfflineReady(false);
        return;
      }
      const ok = await isOfflineAvailable(docId);
      if (cancelled) return;
      setOfflineReady(ok);
      if (ok) {
        const url = await getOfflineObjectUrl(docId);
        if (!cancelled && url) {
          revoked = url;
          setOfflineUrl(url);
        }
      } else {
        setOfflineUrl(null);
      }
    }
    check();
    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [native, docId]);

  const [panelOpen, setPanelOpen] = useState(false);
  const [pageFrom, setPageFrom] = useState("1");
  const [pageTo, setPageTo] = useState("");
  const [difficulty, setDifficulty] = useState("medium");
  const [count, setCount] = useState(10);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [quiz, setQuiz] = useState(null); // { questions, index, answers, submitted }
  const viewerRef = useRef(null);
  const [offlineReady, setOfflineReady] = useState(false);
  const [offlineBusy, setOfflineBusy] = useState(false);
  const [offlineUrl, setOfflineUrl] = useState(null);
  const native = isNativeApp();

  // Optional direct URL when opened from Materials (not in documents collection)
  const fallbackUrl = search.get("url") || "";
  const fallbackTitle = search.get("title") || "Material";

  const record = item === null && fallbackUrl
    ? {
        id: docId || "external",
        title: fallbackTitle,
        fileUrl: fallbackUrl,
        fileName: fallbackTitle,
        courseCode: search.get("code") || null,
      }
    : item;

  async function startGenerate(e) {
    e?.preventDefault();
    setError("");
    if (!pro) {
      setError("Practice with AI is a Pro feature.");
      return;
    }
    if (!record?.fileUrl) {
      setError("No file available for this material.");
      return;
    }

    const n = Math.min(Math.max(Number(count) || 1, 1), 50);
    const pf = Number(pageFrom) || 1;
    const pt = Number(pageTo) || pf;
    if (pt < pf) {
      setError("End page must be greater than or equal to start page.");
      return;
    }
    if (!["easy", "medium", "hard"].includes(difficulty)) {
      setError("Choose easy, medium, or hard.");
      return;
    }

    setBusy(true);
    setQuiz(null);
    try {
      const questions = await generateQuestionsFromDocument({
        pdfUrl: record.fileUrl,
        fileName: record.fileName || `${record.title || "material"}.pdf`,
        count: n,
        difficulty,
        documentTitle: record.title,
        pageFrom: pf,
        pageTo: pt,
      });
      if (!questions?.length) {
        throw new Error("No questions were generated. Try a different page range.");
      }
      setQuiz({
        questions,
        index: 0,
        answers: {},
        submitted: false,
        meta: { pageFrom: pf, pageTo: pt, difficulty, count: questions.length },
      });
    } catch (err) {
      setError(err.message || "Could not generate quiz.");
    } finally {
      setBusy(false);
    }
  }

  function selectAnswer(qIdx, optIdx) {
    if (!quiz || quiz.submitted) return;
    setQuiz((q) => ({
      ...q,
      answers: { ...q.answers, [qIdx]: optIdx },
    }));
  }

  function submitQuiz() {
    if (!quiz) return;
    setQuiz((q) => ({ ...q, submitted: true }));
  }

  const score = useMemo(() => {
    if (!quiz?.submitted) return null;
    let correct = 0;
    quiz.questions.forEach((q, i) => {
      if (quiz.answers[i] === q.correctIndex) correct += 1;
    });
    return { correct, total: quiz.questions.length };
  }, [quiz]);

  if (item === undefined && !fallbackUrl) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-sm text-ink-muted">
        <Loader2 className="mr-2 animate-spin" size={16} /> Loading document…
      </div>
    );
  }

  if (record === null || (!record?.fileUrl && item === null)) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <FileText size={28} className="text-ink-muted" />
        <p className="text-sm text-ink-muted">This document isn&apos;t available anymore.</p>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-dark"
        >
          Go back
        </button>
      </div>
    );
  }

  const ext = getExtension(record.fileName, record.fileUrl);
  const isPdf = ext === "pdf" || (record.fileUrl || "").toLowerCase().includes(".pdf");
  const downloadUrl = withDownloadFlag(
    record.fileUrl,
    record.fileName || record.title
  );
  // In-app PDF viewer — prefer native embed; Google viewer as fallback for office docs
  async function toggleOffline() {
    if (!native || !record?.fileUrl || !docId || docId === "external") return;
    setOfflineBusy(true);
    try {
      if (offlineReady) {
        await removeMaterialOffline(docId);
        if (offlineUrl) URL.revokeObjectURL(offlineUrl);
        setOfflineUrl(null);
        setOfflineReady(false);
      } else {
        await saveMaterialOffline({
          id: docId,
          title: record.title,
          fileUrl: record.fileUrl,
          courseCode: record.courseCode,
          fileName: record.fileName,
        });
        const url = await getOfflineObjectUrl(docId);
        setOfflineUrl(url);
        setOfflineReady(true);
      }
    } catch (e) {
      alert(e.message || "Offline save failed. Need network once to download.");
    } finally {
      setOfflineBusy(false);
    }
  }

  const effectiveUrl = offlineUrl || record.fileUrl;
  const viewerSrc = isPdf
    ? `${effectiveUrl}#toolbar=1&navpanes=0`
    : offlineUrl
      ? effectiveUrl
      : `https://docs.google.com/viewer?url=${encodeURIComponent(record.fileUrl)}&embedded=true`;

  const currentQ = quiz?.questions?.[quiz.index];

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-bg-app md:static md:z-auto md:h-[calc(100vh-2rem)] md:overflow-hidden md:rounded-2xl md:border md:border-border-light">
      {/* Top bar */}
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border-light bg-card-light/95 px-3 py-2.5 backdrop-blur sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-ink-muted hover:bg-bg-panel-alt hover:text-ink"
            aria-label="Back"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0">
            <h1 className="truncate font-display text-sm font-semibold text-ink">
              {record.title || "Document"}
            </h1>
            <p className="truncate text-[11px] text-ink-muted">
              {[record.courseCode, record.faculty, record.level]
                .filter(Boolean)
                .join(" · ") || "In-app reader"}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <a
            href={downloadUrl || record.fileUrl}
            download
            className="hidden h-9 items-center gap-1.5 rounded-xl border border-border-light px-2.5 text-xs font-medium text-ink hover:border-teal sm:inline-flex"
          >
            <Download size={14} /> Download
          </a>
          <button
            type="button"
            onClick={() => setPanelOpen((v) => !v)}
            className={`inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition ${
              panelOpen
                ? "bg-teal text-white"
                : "bg-gradient-to-r from-teal to-teal-dark text-white shadow-sm"
            }`}
          >
            <Sparkles size={14} />
            <span className="hidden sm:inline">Practice with AI</span>
            <span className="sm:hidden">AI</span>
            {!pro && <Crown size={12} className="opacity-90" />}
          </button>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        {/* Reader */}
        <div className="relative min-w-0 flex-1 bg-[#1a1f1c]">
          {native && docId && docId !== "external" && record?.fileUrl && (
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={offlineBusy}
                onClick={toggleOffline}
                className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                  offlineReady
                    ? "bg-teal-soft text-teal border border-teal/30"
                    : "bg-card-light border border-border-light text-ink hover:border-teal/40"
                }`}
              >
                {offlineBusy ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Download size={14} />
                )}
                {offlineReady ? "Saved offline — tap to remove" : "Make available offline"}
              </button>
              {offlineReady && (
                <span className="text-[11px] text-ink-muted">
                  Opens without mobile data in the app
                </span>
              )}
            </div>
          )}

          <iframe
            ref={viewerRef}
            title={record.title || "Document viewer"}
            src={viewerSrc}
            className="h-full w-full border-0 bg-white"
            allow="fullscreen"
          />
        </div>

        {/* AI practice panel */}
        {panelOpen && (
          <aside className="absolute inset-y-0 right-0 z-20 flex w-full max-w-md flex-col border-l border-border-light bg-card-light shadow-2xl sm:relative sm:max-w-sm">
            <div className="flex items-center justify-between border-b border-border-light px-4 py-3">
              <div>
                <p className="font-display text-sm font-semibold text-ink flex items-center gap-1.5">
                  <Sparkles size={15} className="text-teal" /> Practice with AI
                </p>
                <p className="text-[11px] text-ink-muted">
                  Generate a quiz from this material
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPanelOpen(false)}
                className="rounded-lg p-1.5 text-ink-muted hover:bg-bg-panel-alt"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {!pro ? (
                <div className="rounded-2xl border border-border-light bg-bg-panel-alt/50 p-5 text-center">
                  <Crown className="mx-auto mb-2 text-amber-500" size={28} />
                  <p className="text-sm font-semibold text-ink">Pro feature</p>
                  <p className="mt-1 text-xs text-ink-muted">
                    Upgrade to generate AI practice questions from any material —
                    choose pages, difficulty, and up to 50 questions.
                  </p>
                  <Link
                    to="/dashboard/upgrade"
                    className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-teal px-4 py-2.5 text-xs font-semibold text-white hover:bg-teal-dark"
                  >
                    <Crown size={13} /> Go Pro
                  </Link>
                </div>
              ) : !quiz ? (
                <form onSubmit={startGenerate} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-ink-muted">
                        From page
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={pageFrom}
                        onChange={(e) => setPageFrom(e.target.value)}
                        className={field}
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-ink-muted">
                        To page
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={pageTo}
                        onChange={(e) => setPageTo(e.target.value)}
                        placeholder="e.g. 12"
                        className={field}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[11px] font-medium text-ink-muted">
                      Difficulty
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {["easy", "medium", "hard"].map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setDifficulty(d)}
                          className={`rounded-xl border px-2 py-2 text-xs font-semibold capitalize transition ${
                            difficulty === d
                              ? "border-teal bg-teal-soft text-teal"
                              : "border-border-light text-ink hover:border-teal/40"
                          }`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-ink-muted">
                      Number of questions (max 50)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={count}
                      onChange={(e) =>
                        setCount(Math.min(50, Math.max(1, Number(e.target.value) || 1)))
                      }
                      className={field}
                    />
                  </div>

                  {error && (
                    <p className="rounded-xl bg-status-danger/10 px-3 py-2 text-xs text-status-danger">
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={busy}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-teal px-4 py-3 text-sm font-semibold text-white hover:bg-teal-dark disabled:opacity-60"
                  >
                    {busy ? (
                      <>
                        <Loader2 size={16} className="animate-spin" /> Generating…
                      </>
                    ) : (
                      <>
                        <Sparkles size={16} /> Generate quiz
                      </>
                    )}
                  </button>
                  <p className="text-[10px] text-ink-muted leading-relaxed">
                    Questions are generated from pages {pageFrom || "?"}–{pageTo || "?"}
                    {" · "}
                    {difficulty} · up to {count} Qs. PDF only works best for accurate page focus.
                  </p>
                </form>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-[11px] text-ink-muted">
                    <span>
                      Q{quiz.index + 1} / {quiz.questions.length}
                      {quiz.meta && (
                        <> · p.{quiz.meta.pageFrom}–{quiz.meta.pageTo} · {quiz.meta.difficulty}</>
                      )}
                    </span>
                    <button
                      type="button"
                      className="font-medium text-teal hover:underline"
                      onClick={() => {
                        setQuiz(null);
                        setError("");
                      }}
                    >
                      New quiz
                    </button>
                  </div>

                  {score && (
                    <div className="rounded-xl border border-teal/30 bg-teal-soft px-3 py-2 text-sm font-semibold text-teal">
                      Score: {score.correct} / {score.total}
                    </div>
                  )}

                  {currentQ && (
                    <div className="space-y-3">
                      <p className="text-sm font-medium text-ink leading-relaxed">
                        {currentQ.questionText}
                      </p>
                      <ul className="space-y-2">
                        {(currentQ.options || []).map((opt, oi) => {
                          const selected = quiz.answers[quiz.index] === oi;
                          const isCorrect = currentQ.correctIndex === oi;
                          let cls =
                            "border-border-light hover:border-teal/50 text-ink";
                          if (quiz.submitted) {
                            if (isCorrect) cls = "border-teal bg-teal-soft text-teal";
                            else if (selected) cls = "border-status-danger/50 bg-status-danger/10";
                          } else if (selected) {
                            cls = "border-teal bg-teal-soft text-teal";
                          }
                          return (
                            <li key={oi}>
                              <button
                                type="button"
                                disabled={quiz.submitted}
                                onClick={() => selectAnswer(quiz.index, oi)}
                                className={`flex w-full items-start gap-2 rounded-xl border px-3 py-2.5 text-left text-xs transition ${cls}`}
                              >
                                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-current text-[10px] font-bold">
                                  {String.fromCharCode(65 + oi)}
                                </span>
                                <span className="flex-1">{opt}</span>
                                {quiz.submitted && isCorrect && (
                                  <Check size={14} className="shrink-0 text-teal" />
                                )}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                      {quiz.submitted && currentQ.explanation && (
                        <p className="rounded-xl bg-bg-panel-alt px-3 py-2 text-[11px] text-ink-muted">
                          {currentQ.explanation}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      disabled={quiz.index <= 0}
                      onClick={() =>
                        setQuiz((q) => ({ ...q, index: Math.max(0, q.index - 1) }))
                      }
                      className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl border border-border-light py-2 text-xs font-medium disabled:opacity-40"
                    >
                      <ChevronLeft size={14} /> Prev
                    </button>
                    {quiz.index < quiz.questions.length - 1 ? (
                      <button
                        type="button"
                        onClick={() =>
                          setQuiz((q) => ({
                            ...q,
                            index: Math.min(q.questions.length - 1, q.index + 1),
                          }))
                        }
                        className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl bg-teal py-2 text-xs font-semibold text-white"
                      >
                        Next <ChevronRight size={14} />
                      </button>
                    ) : !quiz.submitted ? (
                      <button
                        type="button"
                        onClick={submitQuiz}
                        className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl bg-teal py-2 text-xs font-semibold text-white"
                      >
                        Submit quiz
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setQuiz(null)}
                        className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl border border-border-light py-2 text-xs font-medium"
                      >
                        Done
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
