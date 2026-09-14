import { useEffect, useMemo, useState, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Flag,
  CheckCircle2,
  XCircle,
  Timer,
  Cloud,
  Keyboard,
  Lightbulb,
  Calculator,
  FunctionSquare,
  BookOpen,
  LogOut,
  Grid3X3,
  X,
} from "lucide-react";
import CbtSubmitModal from "./CbtSubmitModal";

function formatTime(sec) {
  if (sec == null || sec < 0) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function CbtExamWorkspace({
  set,
  questions,
  answers,
  flagged,
  currentIdx,
  timeLeft,
  submitted,
  score,
  profile,
  onSelectAnswer,
  onToggleFlag,
  onNavigate,
  onSubmit,
  onExit,
  onClearAnswer,
}) {
  const [showSubmit, setShowSubmit] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [paletteFilter, setPaletteFilter] = useState("all"); // all | ans | unans | flag
  const [showPaletteMobile, setShowPaletteMobile] = useState(false);

  const q = questions[currentIdx];
  const selected = answers[q?.id];
  const isFlagged = flagged.has(q?.id);

  const stats = useMemo(() => {
    let answered = 0;
    let flaggedCount = 0;
    questions.forEach((qq) => {
      if (answers[qq.id] !== undefined) answered += 1;
      if (flagged.has(qq.id)) flaggedCount += 1;
    });
    return {
      answered,
      flagged: flaggedCount,
      unattempted: questions.length - answered,
      progressPct: Math.round((answered / questions.length) * 100),
    };
  }, [questions, answers, flagged]);

  // Keyboard shortcuts
  useEffect(() => {
    if (submitted) return;
    const handler = (e) => {
      const key = e.key.toUpperCase();
      if (["A", "B", "C", "D"].includes(key)) {
        const idx = key.charCodeAt(0) - 65;
        if (q?.options?.[idx] !== undefined) onSelectAnswer(q.id, idx);
      } else if (key === "F") {
        onToggleFlag(q.id);
      } else if (key === "H") {
        setShowHint((v) => !v);
      } else if (key === "N" || e.key === "ArrowRight") {
        if (currentIdx < questions.length - 1) onNavigate(currentIdx + 1);
      } else if (key === "P" || e.key === "ArrowLeft") {
        if (currentIdx > 0) onNavigate(currentIdx - 1);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [q, currentIdx, questions.length, submitted, onSelectAnswer, onToggleFlag, onNavigate]);

  const filteredPalette = useMemo(() => {
    return questions.map((qq, i) => {
      const status =
        answers[qq.id] !== undefined
          ? flagged.has(qq.id)
            ? "flagged"
            : "answered"
          : flagged.has(qq.id)
            ? "flagged"
            : "unanswered";
      return { qq, i, status };
    }).filter(({ status }) => {
      if (paletteFilter === "all") return true;
      if (paletteFilter === "ans") return status === "answered" || status === "flagged";
      if (paletteFilter === "unans") return status === "unanswered";
      if (paletteFilter === "flag") return status === "flagged";
      return true;
    });
  }, [questions, answers, flagged, paletteFilter]);

  if (!q) return null;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#f9f9ff] text-[#111c2d]">
      {/* Sticky telemetry */}
      <div className="sticky top-0 z-30 border-b border-[#c5c6cd]/30 bg-white/95 shadow-sm backdrop-blur-md">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-2 px-4 py-2.5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-lg bg-[#e7eeff] px-3 py-1.5">
              <span className="h-2.5 w-2.5 animate-ping rounded-full bg-[#0054cd]" />
              <span className="text-sm font-semibold">
                Question {currentIdx + 1}
              </span>
              <span className="text-xs text-[#44474c]">/ {questions.length}</span>
            </div>
            <div className="hidden items-center gap-1.5 rounded-lg bg-[#f0f3ff] px-2.5 py-1.5 text-xs text-[#44474c] sm:flex">
              <Cloud size={14} className="text-emerald-600" />
              Auto-saving
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="rounded-lg bg-[#e7eeff] px-2 py-1">
                <span className="text-[#44474c]">Ans </span>
                <strong>{stats.answered}</strong>
              </span>
              <span className="rounded-lg bg-amber-50 px-2 py-1">
                <span className="text-[#44474c]">Flag </span>
                <strong className="text-amber-700">{stats.flagged}</strong>
              </span>
              <span className="rounded-lg bg-slate-100 px-2 py-1">
                <span className="text-[#44474c]">Left </span>
                <strong>{stats.unattempted}</strong>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {timeLeft != null && (
              <div className="flex items-center gap-2 rounded-lg bg-[#dee8ff] px-3 py-1.5">
                <Timer size={16} className="text-[#0054cd]" />
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-[#44474c]">
                    Remaining
                  </div>
                  <div className="font-mono text-sm font-bold tabular-nums">
                    {formatTime(timeLeft)}
                  </div>
                </div>
              </div>
            )}
            <button
              type="button"
              onClick={() => setShowPaletteMobile(true)}
              className="flex items-center gap-1.5 rounded-lg bg-[#e7eeff] px-3 py-1.5 text-sm font-medium xl:hidden"
            >
              <Grid3X3 size={16} /> Palette
            </button>
            {!submitted ? (
              <button
                type="button"
                onClick={() => setShowSubmit(true)}
                className="flex items-center gap-1.5 rounded-lg bg-[#0e1c2f] px-4 py-2 text-sm font-semibold text-white hover:opacity-95"
              >
                End Test <LogOut size={16} />
              </button>
            ) : (
              <button
                type="button"
                onClick={onExit}
                className="rounded-lg bg-[#0054cd] px-4 py-2 text-sm font-semibold text-white"
              >
                Exit session
              </button>
            )}
          </div>
        </div>
        <div className="h-1.5 w-full bg-[#dee8ff]">
          <div
            className="h-full rounded-full bg-[#0054cd] transition-all duration-500"
            style={{ width: `${stats.progressPct}%` }}
          />
        </div>
      </div>

      <div className="mx-auto grid max-w-[1440px] gap-6 px-4 py-6 sm:px-6 xl:grid-cols-12">
        {/* Main column */}
        <div className="flex min-w-0 flex-col gap-5 xl:col-span-8">
          {/* Course header */}
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded bg-[#dae2ff] px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-[#001847]">
              {set.courseCode}
            </span>
            <span className="font-semibold text-[#111c2d]">{set.courseTitle}</span>
            {set.level && (
              <span className="text-xs text-[#44474c]">· {set.level}</span>
            )}
            {submitted && score && (
              <span className="ml-auto rounded-xl bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-800">
                {score.pct}% · {score.correct}/{score.total}
              </span>
            )}
          </div>

          {/* Question card */}
          <article className="rounded-xl border border-[#c5c6cd]/40 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#f0f3ff]/60 p-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-[#dae2ff] px-2.5 py-1 text-xs font-semibold text-[#001847]">
                  Question {currentIdx + 1} of {questions.length}
                </span>
                {q.topic && (
                  <span className="rounded bg-[#e7eeff] px-2.5 py-1 text-xs text-[#44474c]">
                    {q.topic}
                  </span>
                )}
                {q.difficulty && (
                  <span className="rounded-full bg-[#dee8ff] px-2 py-0.5 text-[11px] font-semibold capitalize text-[#0054cd]">
                    {q.difficulty}
                    {q.marks ? ` · ${q.marks} mark${q.marks > 1 ? "s" : ""}` : ""}
                  </span>
                )}
              </div>
              {!submitted && (
                <button
                  type="button"
                  onClick={() => onToggleFlag(q.id)}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                    isFlagged
                      ? "bg-amber-100 text-amber-900"
                      : "bg-[#f0f3ff] text-[#44474c] hover:bg-[#e7eeff]"
                  }`}
                >
                  <Flag size={14} className={isFlagged ? "fill-amber-600 text-amber-600" : ""} />
                  {isFlagged ? "Flagged" : "Flag for review"}
                  <span className="opacity-60">[F]</span>
                </button>
              )}
            </div>

            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[#44474c]">
              Problem Statement
            </p>
            <h2 className="mb-4 text-lg font-semibold leading-snug text-[#111c2d] sm:text-xl">
              {q.questionText}
            </h2>

            {q.referenceCode && (
              <p className="mb-4 font-mono text-xs text-[#0054cd]">
                REF: {q.referenceCode}
              </p>
            )}

            {/* Options */}
            <div className="flex flex-col gap-2.5" role="radiogroup">
              {(q.options || []).map((opt, idx) => {
                const letter = String.fromCharCode(65 + idx);
                let style =
                  "border-[#c5c6cd]/40 bg-[#f0f3ff] hover:bg-[#e7eeff]";
                if (selected === idx && !submitted) {
                  style = "border-[#0054cd] bg-[#e7eeff] shadow-sm";
                }
                if (submitted) {
                  if (idx === q.correctIndex) {
                    style = "border-emerald-500 bg-emerald-50";
                  } else if (selected === idx) {
                    style = "border-red-400 bg-red-50";
                  } else {
                    style = "border-[#c5c6cd]/30 bg-[#f9f9ff] opacity-60";
                  }
                }

                return (
                  <button
                    key={idx}
                    type="button"
                    disabled={submitted}
                    onClick={() => onSelectAnswer(q.id, idx)}
                    className={`flex w-full items-center justify-between rounded-lg border p-3.5 text-left transition ${style}`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                          selected === idx && !submitted
                            ? "bg-[#316ee9] text-white"
                            : submitted && idx === q.correctIndex
                              ? "bg-emerald-600 text-white"
                              : submitted && selected === idx
                                ? "bg-red-500 text-white"
                                : "bg-[#d8e3fb] text-[#44474c]"
                        }`}
                      >
                        {submitted && idx === q.correctIndex ? (
                          <CheckCircle2 size={14} />
                        ) : submitted && selected === idx ? (
                          <XCircle size={14} />
                        ) : selected === idx && !submitted ? (
                          <CheckCircle2 size={14} />
                        ) : (
                          letter
                        )}
                      </span>
                      <span className="text-sm font-medium">{opt}</span>
                    </div>
                    <span className="hidden text-[10px] uppercase text-[#75777d] sm:inline">
                      Press {letter}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Hint / Explanation */}
            {(q.explanation || q.hintEnabled !== false) && (
              <div className="mt-5 overflow-hidden rounded-lg bg-[#f0f3ff]">
                <button
                  type="button"
                  onClick={() => setShowHint((v) => !v)}
                  className="flex w-full items-center justify-between p-3.5 text-left hover:bg-[#e7eeff]"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded bg-amber-100 text-amber-800">
                      <Lightbulb size={16} />
                    </div>
                    <div>
                      <div className="text-sm font-semibold">
                        {submitted ? "Explanation" : "Practice Mode Hint"}
                      </div>
                      <div className="text-xs text-[#44474c]">
                        {submitted
                          ? "See why this is the correct answer"
                          : "Click to expand · Press H"}
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-bold uppercase text-amber-800">
                    {showHint ? "Hide" : "Show"}
                  </span>
                </button>
                {showHint && q.explanation && (
                  <div className="border-t border-[#c5c6cd]/30 bg-white p-4 text-sm leading-relaxed text-[#111c2d]">
                    {q.explanation}
                  </div>
                )}
                {showHint && !q.explanation && !submitted && (
                  <div className="border-t border-[#c5c6cd]/30 bg-white p-4 text-sm text-[#44474c]">
                    No hint available for this question yet.
                  </div>
                )}
              </div>
            )}

            {/* Nav controls */}
            <div className="mt-6 flex flex-col gap-3 border-t border-[#c5c6cd]/30 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={currentIdx === 0}
                  onClick={() => onNavigate(currentIdx - 1)}
                  className="flex items-center gap-1.5 rounded-lg bg-[#e7eeff] px-4 py-2 text-sm font-medium disabled:opacity-40"
                >
                  <ChevronLeft size={16} /> Previous
                </button>
                {!submitted && (
                  <button
                    type="button"
                    onClick={() => onClearAnswer(q.id)}
                    className="rounded-lg bg-[#f0f3ff] px-3 py-2 text-sm text-[#44474c] hover:bg-[#e7eeff]"
                  >
                    Clear
                  </button>
                )}
              </div>
              <button
                type="button"
                disabled={currentIdx >= questions.length - 1}
                onClick={() => onNavigate(currentIdx + 1)}
                className="flex items-center justify-center gap-2 rounded-lg bg-[#0054cd] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#0040a1] disabled:opacity-40"
              >
                Save & Next <ChevronRight size={16} />
              </button>
            </div>
          </article>

          {/* Keyboard assist */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#c5c6cd]/30 bg-white px-3 py-2 text-xs text-[#44474c]">
            <div className="flex items-center gap-2">
              <Keyboard size={14} className="text-[#0054cd]" />
              <span className="font-semibold text-[#111c2d]">Keyboard:</span>
              <span>[A–D] Select · [N/P] Next/Prev · [F] Flag · [H] Hint</span>
            </div>
            <span className="rounded bg-emerald-50 px-2 py-0.5 font-mono text-[10px] text-emerald-800">
              PRACTICE ENGINE
            </span>
          </div>
        </div>

        {/* Right column – Palette (desktop) */}
        <aside className="hidden flex-col gap-4 xl:col-span-4 xl:flex">
          <PalettePanel
            questions={questions}
            answers={answers}
            flagged={flagged}
            currentIdx={currentIdx}
            submitted={submitted}
            score={score}
            paletteFilter={paletteFilter}
            setPaletteFilter={setPaletteFilter}
            filteredPalette={filteredPalette}
            onNavigate={onNavigate}
          />

          {/* Toolkit */}
          <div className="rounded-xl border border-[#c5c6cd]/40 bg-white p-4 shadow-sm">
            <h4 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
              <Calculator size={16} className="text-[#0054cd]" /> Examination Toolkit
            </h4>
            <div className="space-y-2">
              {[
                { icon: Calculator, title: "Scientific Calculator", sub: "Trig, Logs, Powers" },
                { icon: FunctionSquare, title: "Formulae Sheet", sub: "Identities & Series" },
                { icon: BookOpen, title: "Reading Hub", sub: "Related course notes" },
              ].map((t) => (
                <div
                  key={t.title}
                  className="flex cursor-default items-center gap-3 rounded-lg bg-[#f0f3ff] p-2.5"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded bg-[#e7eeff]">
                    <t.icon size={16} />
                  </div>
                  <div>
                    <div className="text-sm font-medium">{t.title}</div>
                    <div className="text-[11px] text-[#44474c]">{t.sub}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Session info */}
          <div className="rounded-xl border border-[#c5c6cd]/40 bg-white p-4 text-xs shadow-sm">
            <div className="flex justify-between py-1">
              <span className="text-[#44474c]">Candidate</span>
              <span className="font-medium">
                {profile?.displayName || profile?.name || "Student"}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-[#44474c]">Matric / ID</span>
              <span className="font-mono">{profile?.uniqueId || "—"}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-[#44474c]">Course</span>
              <span className="font-medium">{set.courseCode}</span>
            </div>
          </div>
        </aside>
      </div>

      {/* Mobile palette drawer */}
      {showPaletteMobile && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40 xl:hidden">
          <div className="max-h-[80vh] w-full overflow-y-auto rounded-t-2xl bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">Question Palette</h3>
              <button type="button" onClick={() => setShowPaletteMobile(false)}>
                <X size={20} />
              </button>
            </div>
            <PalettePanel
              questions={questions}
              answers={answers}
              flagged={flagged}
              currentIdx={currentIdx}
              submitted={submitted}
              score={score}
              paletteFilter={paletteFilter}
              setPaletteFilter={setPaletteFilter}
              filteredPalette={filteredPalette}
              onNavigate={(i) => {
                onNavigate(i);
                setShowPaletteMobile(false);
              }}
            />
          </div>
        </div>
      )}

      <CbtSubmitModal
        open={showSubmit}
        onClose={() => setShowSubmit(false)}
        onConfirm={() => {
          setShowSubmit(false);
          onSubmit();
        }}
        stats={stats}
        timeLeft={timeLeft}
        courseLabel={`${set.courseCode} · ${set.courseTitle}`}
        total={questions.length}
      />
    </div>
  );
}

function PalettePanel({
  questions,
  answers,
  flagged,
  currentIdx,
  submitted,
  score,
  paletteFilter,
  setPaletteFilter,
  filteredPalette,
  onNavigate,
}) {
  return (
    <div className="rounded-xl border border-[#c5c6cd]/40 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          <Grid3X3 size={16} className="text-[#0054cd]" /> Question Palette
        </h3>
        <span className="font-mono text-xs text-[#44474c]">{questions.length} TOTAL</span>
      </div>

      <div className="mb-3 grid grid-cols-4 gap-1 rounded-lg bg-[#f0f3ff] p-1 text-[11px] font-medium">
        {[
          { id: "all", label: "All" },
          { id: "ans", label: "Ans" },
          { id: "unans", label: "Unans" },
          { id: "flag", label: "Flag" },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setPaletteFilter(t.id)}
            className={`rounded py-1.5 ${
              paletteFilter === t.id
                ? "bg-[#0e1c2f] text-white"
                : "text-[#44474c] hover:bg-[#e7eeff]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid max-h-[320px] grid-cols-5 gap-1.5 overflow-y-auto p-0.5 sm:grid-cols-8 xl:grid-cols-5">
        {filteredPalette.map(({ qq, i, status }) => {
          let cls = "bg-[#e7eeff] text-[#44474c]";
          if (i === currentIdx) cls = "bg-[#316ee9] text-white font-bold shadow";
          else if (submitted) {
            const correct = answers[qq.id] === qq.correctIndex;
            if (answers[qq.id] === undefined) cls = "bg-slate-200 text-slate-500";
            else if (correct) cls = "bg-emerald-500 text-white";
            else cls = "bg-red-100 text-red-700";
          } else if (status === "flagged") cls = "bg-amber-100 text-amber-900 relative";
          else if (status === "answered") cls = "bg-emerald-600 text-white";

          return (
            <button
              key={qq.id}
              type="button"
              onClick={() => onNavigate(i)}
              className={`relative flex h-9 items-center justify-center rounded text-xs font-medium transition hover:opacity-90 ${cls}`}
            >
              {String(i + 1).padStart(2, "0")}
              {status === "flagged" && i !== currentIdx && !submitted && (
                <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-amber-500" />
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-[#44474c]">
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded bg-emerald-600" /> Answered
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded bg-[#316ee9]" /> Current
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded bg-amber-200" /> Flagged
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded bg-[#e7eeff]" /> Unattempted
        </span>
      </div>
    </div>
  );
}