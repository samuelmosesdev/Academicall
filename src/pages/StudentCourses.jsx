import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  BookOpen, Check, CheckCircle2, Crown, FileScan, GraduationCap, Layers, Library, Loader2, Plus, RotateCcw, Search, Trash2,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { myCoursesApi } from "../lib/api";
import { appConfirm, notify } from "../lib/dialogs";
import { logActivity } from "../lib/activityLog";
import AiCourseImportModal from "../components/AiCourseImportModal";
import { PageHeader, LoadingState, ErrorState, EmptyState, SearchField, Pager } from "../components/ui";

/**
 * Courses: the student's own list, plus the courses their programme's
 * national curriculum (and department) suggests, plus the full catalogue.
 * Everything is saved on the server as it happens: there is no "Save" step.
 */

const SOURCE_LABEL = { catalogue: "Catalogue", custom: "Added by you", ai: "From your slip", courseRep: "Course Rep", legacy: "Earlier list" };
const FROM_LABEL = { curriculum: "Programme", general: "General studies", department: "Department", courseRep: "Course Rep" };
const levelNum = (lvl) => {
  const m = /(\d{3})/.exec(String(lvl || ""));
  if (m) return Number(m[1]);
  const r = /(HND|ND|NCE)\s*(I{1,3})\b/i.exec(String(lvl || ""));
  return r ? (r[1].toUpperCase() === "HND" ? 300 : 0) + r[2].length * 100 : null;
};
const levelName = (n, tier) => {
  if (n == null) return "Other";
  if (tier === "ND") return n <= 200 ? `ND ${"I".repeat(n / 100)}` : `HND ${"I".repeat(n / 100 - 2)}`;
  if (tier === "NCE") return `NCE ${"I".repeat(n / 100)}`;
  return `${n} Level`;
};
const unitsOf = (list) => list.reduce((sum, c) => sum + (Number(c.units) || 0), 0);

function CourseLine({ course, right, picked, added, onToggle }) {
  const Tag = onToggle && !added ? "button" : "div";
  return (
    <Tag
      type={Tag === "button" ? "button" : undefined}
      onClick={Tag === "button" ? onToggle : undefined}
      className={`acx-course w-full text-left ${picked ? "is-picked" : ""} ${added ? "is-added" : ""}`}
      aria-pressed={Tag === "button" ? picked : undefined}
    >
      {onToggle ? (
        <span className={`acx-check ${added ? "is-done" : picked ? "is-on" : ""}`} aria-hidden="true"><Check size={13} strokeWidth={3} /></span>
      ) : (
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-soft text-accent" aria-hidden="true"><BookOpen size={16} /></span>
      )}
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          {course.code && <span className="acx-code">{course.code}</span>}
          <span className="acx-course-title">{course.title}</span>
        </div>
        <div className="acx-course-meta">
          {course.units != null && <span>{course.units} unit{course.units === 1 ? "" : "s"}</span>}
          {course.semester && <span>{course.semester} semester</span>}
          {course.status && <span className={`acx-chip-sm ${course.status === "Compulsory" ? "is-aqua" : ""}`}>{course.status}</span>}
          {course.legacy && <span className="acx-chip-sm is-lemon">Older curriculum</span>}
          {added && <span className="acx-chip-sm is-aqua"><CheckCircle2 size={11} /> On your list</span>}
        </div>
      </div>
      {right}
    </Tag>
  );
}

export default function StudentCourses() {
  const { user, profile } = useAuth();
  const [mine, setMine] = useState([]);
  const [limit, setLimit] = useState(null);
  const [data, setData] = useState(null); // { suggestions, curricula, profile }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [legacy, setLegacy] = useState(false);

  const [q, setQ] = useState("");
  const [levelFilter, setLevelFilter] = useState("mine");
  const [semester, setSemester] = useState("all");
  const [picked, setPicked] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState(null);
  const [showImport, setShowImport] = useState(false);

  const [manual, setManual] = useState({ code: "", title: "" });
  const [manualErr, setManualErr] = useState("");
  const [catalogQ, setCatalogQ] = useState("");
  const [catalog, setCatalog] = useState({ courses: [], total: 0, page: 1, pageSize: 20, loading: false });

  const load = useCallback(async (opts = {}) => {
    setError("");
    try {
      const [list, sug] = await Promise.all([myCoursesApi.list(), myCoursesApi.suggestions({ legacy: opts.legacy ?? legacy })]);
      setMine(list.courses || []);
      setLimit(list.limit ?? null);
      setData(sug);
    } catch (err) {
      setError(err.message || "Couldn't load your courses");
    } finally {
      setLoading(false);
    }
  }, [legacy]);
  useEffect(() => { load(); }, [load]);

  // Default level filter: the student's own level when the curriculum has it.
  const myLevel = data?.profile?.levelNumber ?? levelNum(profile?.level);
  const tier = data?.profile?.tier;
  const levels = useMemo(() => {
    const set = new Set((data?.suggestions || []).map((s) => levelNum(s.level)).filter((n) => n != null));
    return [...set].sort((a, b) => a - b);
  }, [data]);
  useEffect(() => {
    if (levelFilter === "mine" && levels.length && myLevel != null && !levels.includes(myLevel)) setLevelFilter("all");
  }, [levels, myLevel, levelFilter]);

  const mineCodes = useMemo(() => new Set(mine.map((c) => (c.code || "").toUpperCase())), [mine]);
  const mineIds = useMemo(() => new Set(mine.map((c) => c.courseId).filter(Boolean)), [mine]);
  const isAdded = useCallback((s) => mineIds.has(s.courseId) || (s.code && mineCodes.has(s.code.toUpperCase())), [mineIds, mineCodes]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data?.suggestions || []).filter((s) => {
      const n = levelNum(s.level);
      if (levelFilter === "mine" && myLevel != null && n !== myLevel) return false;
      if (levelFilter !== "mine" && levelFilter !== "all" && n !== Number(levelFilter)) return false;
      if (semester !== "all" && s.semester !== semester) return false;
      if (needle && !`${s.code} ${s.title}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [data, q, levelFilter, semester, myLevel]);

  const groups = useMemo(() => {
    const map = new Map();
    for (const s of shown) {
      const key = `${levelNum(s.level) ?? 999}|${s.semester || "—"}`;
      if (!map.has(key)) map.set(key, { level: levelNum(s.level), semester: s.semester, items: [] });
      map.get(key).items.push(s);
    }
    return [...map.values()].sort((a, b) => (a.level ?? 999) - (b.level ?? 999) || String(a.semester).localeCompare(String(b.semester)));
  }, [shown]);

  const room = limit == null ? Infinity : Math.max(0, limit - mine.length);
  const full = room === 0;
  const pickable = shown.filter((s) => !isAdded(s));

  function toggle(s) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(s.courseId)) next.delete(s.courseId);
      else {
        if (next.size >= room) { notify.error(`Your plan has room for ${room} more course${room === 1 ? "" : "s"}.`); return prev; }
        next.add(s.courseId);
      }
      return next;
    });
  }
  function pickAllShown() {
    const ids = pickable.map((s) => s.courseId).slice(0, room === Infinity ? undefined : room);
    setPicked(new Set(ids));
    if (room !== Infinity && pickable.length > room) notify.info(`Picked the first ${room}; that's all your plan has room for.`);
  }

  async function addPicked() {
    if (!picked.size) return;
    setBusy(true);
    try {
      const r = await myCoursesApi.addMany({ courseIds: [...picked] });
      if (r.added?.length) notify.success(`Added ${r.added.length} course${r.added.length === 1 ? "" : "s"}`);
      const limitHit = r.skipped?.find((s) => s.code === "limit");
      if (limitHit) notify.error(limitHit.reason);
      setPicked(new Set());
      await load();
      window.dispatchEvent(new Event("courses:changed"));
    } catch (err) {
      notify.error(err.message || "Couldn't add those courses");
    } finally {
      setBusy(false);
    }
  }

  async function addOne(courseId) {
    try {
      await myCoursesApi.add({ courseId });
      notify.success("Added to your courses");
      await load();
      setCatalog((c) => ({ ...c, courses: c.courses.map((x) => (x.id === courseId ? { ...x, added: true } : x)) }));
      window.dispatchEvent(new Event("courses:changed"));
    } catch (err) {
      notify.error(err.message || "Couldn't add that course");
    }
  }

  async function remove(c) {
    const ok = await appConfirm(`Remove ${c.code || c.title} from your courses? Your materials and practice history stay.`, { confirmLabel: "Remove", tone: "danger" });
    if (!ok) return;
    setRemoving(c.id);
    try {
      await myCoursesApi.remove(c.id);
      setMine((list) => list.filter((x) => x.id !== c.id));
      notify.success(`${c.code || "Course"} removed`);
      window.dispatchEvent(new Event("courses:changed"));
    } catch (err) {
      notify.error(err.message || "Couldn't remove it");
    } finally {
      setRemoving(null);
    }
  }

  async function addManual(e) {
    e.preventDefault();
    setManualErr("");
    const code = manual.code.trim().toUpperCase();
    const title = manual.title.trim();
    if (!/^[A-Z]{2,5}\s?-?\d{3}[A-Z]?$/.test(code)) { setManualErr("Use a code like CSC 201"); return; }
    if (title.length < 3) { setManualErr("Add the course title"); return; }
    try {
      await myCoursesApi.add({ code, title });
      setManual({ code: "", title: "" });
      notify.success(`${code} added`);
      await load();
      window.dispatchEvent(new Event("courses:changed"));
    } catch (err) {
      setManualErr(err.message || "Couldn't add it");
    }
  }

  async function handleImport(extracted) {
    setShowImport(false);
    const custom = (extracted || [])
      .map((x) => ({ code: String(x.code || x.courseCode || "").trim().toUpperCase(), title: String(x.title || x.courseTitle || "").trim() }))
      .filter((x) => x.code && x.title);
    if (!custom.length) { notify.error("No courses were found on that document."); return; }
    try {
      const r = await myCoursesApi.addMany({ custom, source: "ai" });
      const dupes = (r.skipped || []).filter((s) => s.code === "duplicate").length;
      notify.success(`Added ${r.added.length} course${r.added.length === 1 ? "" : "s"} from your slip${dupes ? ` · ${dupes} already on your list` : ""}`);
      const limitHit = r.skipped?.find((s) => s.code === "limit");
      if (limitHit) notify.error(limitHit.reason);
      if (user) logActivity({ actorUid: user.uid, actorName: profile?.name || user.email, action: "courses.ai_import", reference: `${r.added.length} courses`, meta: { codes: r.added.map((c) => c.code) } }).catch(() => {});
      await load();
    } catch (err) {
      notify.error(err.message || "Couldn't import those courses");
    }
  }

  // full catalogue search
  useEffect(() => {
    if (catalogQ.trim().length < 2) { setCatalog((c) => ({ ...c, courses: [], total: 0, page: 1 })); return; }
    let live = true;
    setCatalog((c) => ({ ...c, loading: true }));
    myCoursesApi.searchCatalog({ q: catalogQ.trim(), page: catalog.page, pageSize: 20 })
      .then((r) => live && setCatalog({ ...r, loading: false }))
      .catch(() => live && setCatalog((c) => ({ ...c, loading: false })));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogQ, catalog.page]);

  if (loading) return <LoadingState message="Loading your courses…" />;
  if (error) return <ErrorState title="Courses didn't load" message={error} onRetry={() => { setLoading(true); load(); }} />;

  const p = data?.profile || {};
  const programmeLine = [p.programme, p.institution, p.level].filter(Boolean).join(" · ");
  const totalUnits = unitsOf(mine);

  return (
    <div className="space-y-6 pb-24">
      <PageHeader
        title="Courses"
        description={programmeLine || "Pick the courses you're taking this session. Your materials, practice and timetable follow this list."}
        actions={
          <>
            <button type="button" className="acx-btn-ghost" onClick={() => setShowImport(true)} disabled={full}>
              <FileScan size={15} /> Import from course form
            </button>
            {limit != null && (
              <Link to="/dashboard/upgrade" className="acx-btn"><Crown size={15} /> Unlimited courses</Link>
            )}
          </>
        }
      />

      {/* Summary */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="acx-stat is-ink">
          <div className="acx-stat-n">{mine.length}{limit != null && <span className="text-[1.1rem] text-white/50"> / {limit}</span>}</div>
          <div className="acx-stat-l">On your list</div>
          {limit != null && <div className={`acx-meter mt-3 ${full ? "is-full" : ""}`}><span style={{ width: `${Math.min(100, (mine.length / limit) * 100)}%` }} /></div>}
        </div>
        <div className="acx-stat">
          <div className="acx-stat-n">{totalUnits}</div>
          <div className="acx-stat-l">Credit units</div>
          <div className="acx-stat-h">From courses with units in the catalogue</div>
        </div>
        <div className="acx-stat is-lemon">
          <div className="acx-stat-n">{(data?.suggestions || []).filter((s) => !isAdded(s)).length}</div>
          <div className="acx-stat-l">Suggested for you</div>
          <div className="acx-stat-h">{data?.curricula?.length ? `${data.curricula.length} curriculum list${data.curricula.length === 1 ? "" : "s"} for your programme` : "Set your programme to get suggestions"}</div>
        </div>
      </div>

      {/* My courses */}
      <section className="acx-card">
        <div className="acx-card-head">
          <div>
            <h3>My courses</h3>
            <p>Saved as you add them. Remove a course any time.</p>
          </div>
          {full && <span className="acx-chip-sm is-danger">Plan limit reached</span>}
        </div>
        {mine.length === 0 ? (
          <EmptyState icon={GraduationCap} title="No courses yet" description="Tick the ones you're taking from the suggestions, search the catalogue, or import your course registration form." className="!py-10" />
        ) : (
          <div className="grid gap-2 lg:grid-cols-2">
            {mine.map((c) => (
              <CourseLine
                key={c.id}
                course={c}
                right={
                  <div className="flex items-center gap-2">
                    <span className={`acx-chip-sm ${c.archived ? "is-danger" : ""}`}>{c.archived ? "Retired" : SOURCE_LABEL[c.source] || "Course"}</span>
                    <button type="button" className="acx-icon-btn is-danger" onClick={() => remove(c)} disabled={removing === c.id} aria-label={`Remove ${c.code || c.title}`}>
                      {removing === c.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </button>
                  </div>
                }
              />
            ))}
          </div>
        )}
      </section>

      {/* Suggestions */}
      <section className="acx-card">
        <div className="acx-card-head">
          <div>
            <h3>Suggested for your programme</h3>
            <p>
              {data?.curricula?.length
                ? `From ${data.curricula.filter((c) => !c.general).map((c) => c.name).slice(0, 2).join(" and ") || "your general studies"}${data.curricula[0]?.edition ? ` · ${data.curricula.find((c) => !c.general)?.edition || data.curricula[0].edition}` : ""}`
                : "Courses your department and Course Rep have listed."}
            </p>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-text-secondary">
            <button type="button" role="switch" aria-checked={legacy} className={`acx-switch ${legacy ? "is-on" : ""}`} onClick={() => { const v = !legacy; setLegacy(v); load({ legacy: v }); }}><span /></button>
            Include the older curriculum (pre-2024)
          </label>
        </div>

        {!p.hasProgramme && (
          <div className="acx-callout mb-4">
            <Layers size={18} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">Add your programme to see its full course list</p>
              <p className="mt-0.5 text-[0.8rem] opacity-80">We match your institution and programme to the national curriculum (NUC, NBTE or NCCE). <Link to="/dashboard/profile" className="font-semibold underline">Update your academic details</Link></p>
            </div>
          </div>
        )}

        {(data?.suggestions || []).length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <SearchField value={q} onChange={setQ} placeholder="Filter by code or title" className="w-full sm:w-64" />
            <div className="acx-seg max-w-full overflow-x-auto">
              {myLevel != null && levels.includes(myLevel) && <button type="button" className={levelFilter === "mine" ? "is-on" : ""} onClick={() => setLevelFilter("mine")}>My level</button>}
              <button type="button" className={levelFilter === "all" ? "is-on" : ""} onClick={() => setLevelFilter("all")}>All</button>
              {levels.map((n) => <button key={n} type="button" className={levelFilter === String(n) ? "is-on" : ""} onClick={() => setLevelFilter(String(n))}>{levelName(n, tier)}</button>)}
            </div>
            <div className="acx-seg">
              {["all", "1st", "2nd"].map((s) => <button key={s} type="button" className={semester === s ? "is-on" : ""} onClick={() => setSemester(s)}>{s === "all" ? "Both semesters" : `${s} sem`}</button>)}
            </div>
            {pickable.length > 0 && !full && <button type="button" className="acx-btn-ghost whitespace-nowrap sm:ml-auto" onClick={pickAllShown}><Check size={14} /> Pick all shown</button>}
          </div>
        )}

        {(data?.suggestions || []).length === 0 ? (
          <EmptyState icon={Library} title="No suggestions yet" description={p.hasProgramme ? "Your programme isn't matched to a published curriculum yet. Search the catalogue below or add a course yourself." : "Once your programme is set, its courses show up here."} className="!py-10" />
        ) : shown.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-sm text-text-muted">
            <Search size={20} /> Nothing matches these filters.
            <button type="button" className="acx-btn-ghost" onClick={() => { setQ(""); setLevelFilter("all"); setSemester("all"); }}><RotateCcw size={13} /> Clear filters</button>
          </div>
        ) : (
          groups.map((g) => (
            <div key={`${g.level}-${g.semester}`}>
              <div className="acx-group-label">
                <span>{levelName(g.level, tier)} · {g.semester ? `${g.semester} semester` : "Any semester"}</span>
                <span className="normal-case tracking-normal">{g.items.length} course{g.items.length === 1 ? "" : "s"} · {unitsOf(g.items)} units</span>
              </div>
              <div className="grid gap-2 lg:grid-cols-2">
                {g.items.map((s) => (
                  <CourseLine
                    key={s.courseId}
                    course={s}
                    added={isAdded(s)}
                    picked={picked.has(s.courseId)}
                    onToggle={() => toggle(s)}
                    right={<span className="acx-chip-sm hidden sm:inline-flex">{FROM_LABEL[s.from] || "Suggested"}</span>}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </section>

      {/* Can't find it */}
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="acx-card">
          <div className="acx-card-head">
            <div>
              <h3>Search the whole catalogue</h3>
              <p>Every course in the national curricula, for electives and carry-overs.</p>
            </div>
          </div>
          <SearchField value={catalogQ} onChange={(v) => { setCatalogQ(v); setCatalog((c) => ({ ...c, page: 1 })); }} placeholder="Try MTH 101 or Thermodynamics" />
          <div className="mt-3 space-y-2">
            {catalog.loading && <div className="flex items-center gap-2 py-4 text-sm text-text-muted"><Loader2 size={15} className="animate-spin" /> Searching…</div>}
            {!catalog.loading && catalogQ.trim().length >= 2 && catalog.courses.length === 0 && <p className="py-4 text-sm text-text-muted">No catalogue course matches “{catalogQ}”. Add it yourself instead.</p>}
            {catalog.courses.map((c) => (
              <CourseLine
                key={c.id}
                course={{ ...c, status: null }}
                added={c.added || isAdded({ courseId: c.id, code: c.code })}
                right={
                  c.added || isAdded({ courseId: c.id, code: c.code })
                    ? <CheckCircle2 size={18} className="text-teal" aria-label="On your list" />
                    : <button type="button" className="acx-btn !px-3 !py-1.5 !text-xs" onClick={() => addOne(c.id)} disabled={full}><Plus size={13} /> Add</button>
                }
              />
            ))}
            {catalog.total > catalog.pageSize && <Pager page={catalog.page} pageSize={catalog.pageSize} total={catalog.total} onPage={(page) => setCatalog((c) => ({ ...c, page }))} />}
          </div>
        </section>

        <section className="acx-card">
          <div className="acx-card-head">
            <div>
              <h3>Add a course yourself</h3>
              <p>For courses your school added that aren't in the catalogue.</p>
            </div>
          </div>
          <form onSubmit={addManual} className="space-y-3" noValidate>
            <div className="grid grid-cols-[7.5rem_1fr] gap-2">
              <input className="acx-input" placeholder="CSC 201" value={manual.code} onChange={(e) => setManual((m) => ({ ...m, code: e.target.value }))} aria-label="Course code" maxLength={12} />
              <input className="acx-input" placeholder="Course title" value={manual.title} onChange={(e) => setManual((m) => ({ ...m, title: e.target.value }))} aria-label="Course title" maxLength={200} />
            </div>
            {manualErr && <p className="acx-field-err">{manualErr}</p>}
            <button type="submit" className="acx-btn" disabled={full}><Plus size={14} /> Add course</button>
          </form>
        </section>
      </div>

      {picked.size > 0 && (
        <div className="acx-savebar !fixed bottom-4 left-1/2 z-40 w-[min(40rem,calc(100vw-2rem))] -translate-x-1/2 lg:left-[calc(50%+8rem)]">
          <span>{picked.size} course{picked.size === 1 ? "" : "s"} picked{room !== Infinity ? ` · room for ${room - picked.size} more` : ""}</span>
          <div className="flex gap-2">
            <button type="button" className="acx-btn-ghost" onClick={() => setPicked(new Set())}>Clear</button>
            <button type="button" className="acx-btn" onClick={addPicked} disabled={busy}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add to my courses
            </button>
          </div>
        </div>
      )}

      {showImport && <AiCourseImportModal open={showImport} onClose={() => setShowImport(false)} onImported={handleImport} studentMode />}
    </div>
  );
}
