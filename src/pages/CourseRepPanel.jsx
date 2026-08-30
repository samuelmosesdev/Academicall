import { useEffect, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import {
  CalendarPlus,
  Send,
  Loader2,
  Trash2,
  Bell,
  Users,
  BookOpen,
  Inbox,
  Upload,
  Sparkles,
} from "lucide-react";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { isCourseRep, isAdmin, isAlpha } from "../lib/roles";
import { logActivity } from "../lib/activityLog";
import { uploadDocumentToCloudinary } from "../lib/cloudinaryUpload";
import AiCourseImportModal from "../components/AiCourseImportModal";
import ScheduleClassModal from "../components/ScheduleClassModal";
import CreateAnnouncementModal from "../components/CreateAnnouncementModal";
import { displayLabel } from "../components/UserAvatar";
import { classEventsApi } from "../lib/api";
import { requestsApi } from "../lib/api";
import { coursesApi } from "../lib/api";

const field =
  "w-full rounded-xl border border-border-light bg-card-light px-3 py-2 text-sm text-ink focus:border-teal focus:outline-none";

const LEVELS = [
  "100 Level",
  "200 Level",
  "300 Level",
  "400 Level",
  "500 Level",
  "Postgraduate",
  "General",
];

export default function CourseRepPanel() {
  const { user, profile, authMode } = useAuth();
  const allowed =
    isCourseRep(profile) || isAdmin(profile) || isAlpha(profile);

  const department =
    profile?.courseRepMeta?.department ||
    profile?.courseRepDepartment ||
    profile?.department ||
    "";
  const level =
    profile?.courseRepMeta?.level ||
    profile?.courseRepLevel ||
    profile?.level ||
    "";
  const faculty =
    profile?.courseRepMeta?.faculty || profile?.faculty || "";

  // Schedule class
  const [title, setTitle] = useState("");
  const [courseCode, setCourseCode] = useState("");
  const [venue, setVenue] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  // Request course
  const [cCode, setCCode] = useState("");
  const [cTitle, setCTitle] = useState("");
  const [cLevel, setCLevel] = useState("100 Level");
  const [cDesc, setCDesc] = useState("");
  const [cBusy, setCBusy] = useState(false);

  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [myClasses, setMyClasses] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [deptCourses, setDeptCourses] = useState([]);
  const [studentCount, setStudentCount] = useState(null);

  // Material upload state
  const [matCourseId, setMatCourseId] = useState("");
  const [matTitle, setMatTitle] = useState("");
  const [matFile, setMatFile] = useState(null);
  const [matBusy, setMatBusy] = useState(false);
  const [matProgress, setMatProgress] = useState(0);

  // AI import
  const [showAiImport, setShowAiImport] = useState(false);

  // Centered mobile composers (viewport modal, not page scroll position)
  const [showSchedule, setShowSchedule] = useState(false);
  const [showAnnounce, setShowAnnounce] = useState(false);

  // Classes created by this rep
  useEffect(() => {
    if (authMode === "api") {
      let alive = true;
      classEventsApi.list().then(({ events = [] }) => {
        if (alive) setMyClasses(events.filter((event) => event.createdBy === user?.uid));
      }).catch(() => alive && setMyClasses([]));
      return () => { alive = false; };
    }
    if (!user?.uid) return;
    const q = query(
      collection(db, "classEvents"),
      where("createdBy", "==", user.uid)
    );
    return onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => {
          const ta = a.startsAt?.toDate?.() || a.startsAt || 0;
          const tb = b.startsAt?.toDate?.() || b.startsAt || 0;
          return new Date(tb) - new Date(ta);
        });
        setMyClasses(list);
      },
      () => setMyClasses([])
    );
  }, [user?.uid, authMode]);

  // My requests (course / material)
  useEffect(() => {
    if (authMode === "api") {
      let alive = true;
      requestsApi.list().then(({ requests = [] }) => {
        if (alive) setMyRequests(requests.filter((request) => request.requesterUid === user?.uid));
      }).catch(() => alive && setMyRequests([]));
      return () => { alive = false; };
    }
    if (!user?.uid) return;
    const unsub = onSnapshot(
      collection(db, "requests"),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((r) => r.requesterUid === user.uid);
        list.sort(
          (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
        );
        setMyRequests(list);
      },
      () => setMyRequests([])
    );
    return unsub;
  }, [user?.uid, authMode]);

  // Courses already for this department
  useEffect(() => {
    if (authMode === "api") {
      if (!department) {
        setDeptCourses([]);
        return undefined;
      }
      let alive = true;
      coursesApi.list().then(({ courses = [] }) => {
        if (!alive) return;
        setDeptCourses(courses
          .filter((course) => course.department === department && (!level || !course.level || course.level === level))
          .sort((a, b) => String(a.code || "").localeCompare(String(b.code || ""))));
      }).catch(() => alive && setDeptCourses([]));
      return () => { alive = false; };
    }
    if (!department) {
      setDeptCourses([]);
      return;
    }
    return onSnapshot(
      collection(db, "courses"),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter(
            (c) =>
              c.department === department &&
              c.published !== false &&
              (!level || !c.level || c.level === level)
          )
          .sort((a, b) =>
            String(a.code || "").localeCompare(String(b.code || ""))
          );
        setDeptCourses(list);
      },
      () => setDeptCourses([])
    );
  }, [department, authMode]);

  // Students in same department AND level only
  useEffect(() => {
    if (authMode === "api") {
      setStudentCount(null);
      return;
    }
    if (!department || !level) {
      setStudentCount(0);
      return;
    }
    (async () => {
      try {
        const snap = await getDocs(
          query(collection(db, "users"), where("department", "==", department))
        );
        const n = snap.docs.filter((d) => {
          const u = d.data();
          const r = u.role || "user";
          if (r !== "user" && r !== "courseRep") return false;
          return String(u.level || "").trim() === String(level).trim();
        }).length;
        setStudentCount(n);
      } catch {
        setStudentCount(null);
      }
    })();
  }, [department, level, authMode]);

  // NOTE: Fan-out of notifications and per-student timetable events
  // is handled server-side by a Cloud Function listening to `classEvents`.

  async function scheduleClass(e) {
    e.preventDefault();
    setMsg("");
    setErr("");
    if (!department || !level) {
      return setErr(
        "No department/level on your Course Rep profile. Ask Admin to assign you with a department AND level."
      );
    }
    if (!title.trim() || !startsAt) {
      return setErr("Title and start time are required.");
    }

    setBusy(true);
    try {
      const start = new Date(startsAt);
      const end = endsAt ? new Date(endsAt) : null;

      const { event } = authMode === "api"
        ? await classEventsApi.create({
            title: title.trim(), courseCode: courseCode.trim().toUpperCase() || null,
            venue: venue.trim() || null, notes: notes.trim() || null,
            startsAt: start.toISOString(), endsAt: end ? end.toISOString() : null,
            faculty: faculty || null, department, level: level || null,
            createdByName: profile?.name || user.email,
          })
        : { event: await addDoc(collection(db, "classEvents"), {
        title: title.trim(),
        courseCode: courseCode.trim().toUpperCase() || null,
        venue: venue.trim() || null,
        notes: notes.trim() || null,
        startsAt: start,
        endsAt: end,
        faculty: faculty || null,
        department,
        level: level || null,
        createdBy: user.uid,
        createdByName: profile?.name || user.email,
        createdAt: serverTimestamp(),
      }) };
      const when = start.toLocaleString();
      const body = [
        courseCode && courseCode.trim().toUpperCase(),
        venue.trim() || "Venue TBA",
        when,
        notes.trim(),
      ]
        .filter(Boolean)
        .join(" · ");
      await logActivity({
        actorUid: user.uid,
        actorName: profile?.name || user.email,
        action: "class.schedule",
        targetUid: null,
        targetName: null,
        reference: event.id,
        meta: { title: title.trim() },
      });

      setTitle("");
      setCourseCode("");
      setVenue("");
      setStartsAt("");
      setEndsAt("");
      setNotes("");
      setMsg(
        `Class scheduled for ${department}${level ? ` · ${level}` : ""}. ${sent} student(s) notified.`
      );
    } catch (error) {
      setErr(error.message || "Failed to schedule. Check Firestore rules.");
    } finally {
      setBusy(false);
    }
  }

  async function cancelClass(ev) {
    const ok = window.confirm(
      `Cancel "${ev.title}"? Students in ${department} · ${level || "your level"} will be notified.`
    );
    if (!ok) return;
    try {
      if (authMode === "api") await classEventsApi.remove(ev.id);
      else await deleteDoc(doc(db, "classEvents", ev.id));
      const when =
        (ev.startsAt?.toDate?.() || ev.startsAt) &&
        new Date(ev.startsAt?.toDate?.() || ev.startsAt).toLocaleString();

      await logActivity({
        actorUid: user.uid,
        actorName: profile?.name || user.email,
        action: "class.cancel",
        reference: department,
        meta: { title: ev.title },
      });
      await logActivity({
        actorUid: user.uid,
        actorName: profile?.name || user.email,
        action: "class.cancel",
        reference: department,
        meta: { title: ev.title },
      });
      setMsg(`Cancelled "${ev.title}" and notified the department.`);
    } catch (error) {
      setErr(error.message || "Could not cancel.");
    }
  }

  async function requestAddCourse(e) {
    e.preventDefault();
    setMsg("");
    setErr("");
    if (!department) {
      return setErr("No department on your Course Rep profile.");
    }
    if (!cCode.trim() || !cTitle.trim()) {
      return setErr("Course code and title are required.");
    }
    setCBusy(true);
    try {
      await requestsApi.create({
        type: "course",
        status: "pending",
        title: `Add course ${cCode.trim().toUpperCase()} — ${cTitle.trim()}`,
        details: cDesc.trim() || null,
        requesterUid: user.uid,
        requesterName: profile?.name || user.email,
        requesterEmail: user.email,
        requesterRole: "courseRep",
        payload: {
          courseDraft: {
            code: cCode.trim().toUpperCase(),
            title: cTitle.trim(),
            description: cDesc.trim() || null,
            level: cLevel || level,
            faculty: faculty || null,
            department,
            published: false,
          },
        },
      });
      setCCode("");
      setCTitle("");
      setCDesc("");
      setMsg(
        "Course request sent. It will appear under Admin → Requests → Course Reps."
      );
    } catch (error) {
      setErr(error.message || "Request failed — check Firestore rules for requests.");
    } finally {
      setCBusy(false);
    }
  }

  async function uploadMaterial(e) {
    e.preventDefault();
    setErr("");
    setMsg("");
    const course = deptCourses.find((c) => c.id === matCourseId);
    if (!course) return setErr("Select a department course.");
    if (!matTitle.trim() || !matFile) return setErr("Title and file required.");

    setMatBusy(true);
    try {
      const res = await uploadDocumentToCloudinary(matFile, (p) => setMatProgress(p));
      const url = res.secure_url || res.url;
      const bytes = res.bytes || matFile.size;
      // Create a request for admin approval (safer than direct publish)
      await requestsApi.create({
        type: "material",
        status: "pending",
        title: `Material: ${matTitle.trim()} (${course.code})`,
        requesterUid: user.uid,
        requesterName: profile?.name || user.email,
        requesterEmail: user.email,
        requesterRole: "courseRep",
        payload: {
          documentDraft: {
            title: matTitle.trim(),
            fileUrl: url,
            fileSize: bytes || matFile.size,
            fileName: matFile.name,
            courseCode: course.code, // CRITICAL for student course view
            courseTitle: course.title,
            faculty: course.faculty || faculty,
            department: course.department || department,
            level: course.level || level || null,
            source: "courseRep",
            status: "published",
          },
        },
      });
      setMatTitle("");
      setMatFile(null);
      setMsg("Material submitted for admin approval. After approve it appears under that course.");
    } catch (ex) {
      setErr(ex.message || "Upload failed");
    } finally {
      setMatBusy(false);
      setMatProgress(0);
    }
  }

  if (!allowed) {
    return (
      <div className="rounded-2xl border border-border-light bg-card-light p-6 text-sm text-ink-muted">
        You are not assigned as a Course Rep. Ask an Admin to assign you under{" "}
        <strong>Users → Make Course Rep</strong> with your department.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-ink">Course Rep panel</h1>
        <p className="text-sm text-ink-muted">
          You represent{" "}
          <strong className="text-ink">
            {department || "— no department set —"}
          </strong>
          {faculty ? ` · ${faculty}` : ""}. Schedule classes, request new courses
          for approval, and track your requests.
        </p>
      </div>

      {/* Mobile-friendly: open composers centered on screen */}
      <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
        <button
          type="button"
          onClick={() => setShowSchedule(true)}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal px-4 py-3 text-sm font-semibold text-white shadow-md shadow-teal/20 active:scale-[0.98]"
        >
          <CalendarPlus size={16} />
          Schedule class
        </button>
        <button
          type="button"
          onClick={() => setShowAnnounce(true)}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-teal/40 bg-teal-soft px-4 py-3 text-sm font-semibold text-teal active:scale-[0.98]"
        >
          <Send size={16} />
          Announce / post
        </button>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="inline-flex items-center gap-2 rounded-xl border border-border-light bg-card-light px-4 py-2 text-sm text-ink">
          <Users size={16} className="text-teal" />
          {studentCount == null
            ? "Counting students…"
            : `${studentCount} student(s) in this department`}
        </div>
        <div className="inline-flex items-center gap-2 rounded-xl border border-border-light bg-card-light px-4 py-2 text-sm text-ink">
          <BookOpen size={16} className="text-teal" />
          {deptCourses.length} course(s) · {level || "no level set"}
        </div>
        <div className="ml-auto">
          <button
            type="button"
            onClick={() => setShowAiImport(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-teal/40 bg-teal-soft px-3 py-2 text-sm font-semibold text-teal"
          >
            <Sparkles size={15} /> AI import courses
          </button>
        </div>
      </div>

      {msg && (
        <p className="rounded-xl bg-teal-soft px-4 py-2 text-sm text-teal">{msg}</p>
      )}
      {err && (
        <p className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-600">{err}</p>
      )}

      {/* Department courses (read-only) */}
      <div className="rounded-2xl border border-border-light bg-card-light p-5">
        <h2 className="mb-3 text-sm font-semibold text-ink">
          Courses for {department || "your department"}
        </h2>
        {deptCourses.length === 0 ? (
          <p className="text-sm text-ink-muted">
            No published courses yet. Request one below for admin approval.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {deptCourses.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center gap-2 rounded-lg bg-surface-light px-3 py-2 text-sm"
              >
                <span className="font-semibold text-teal">{c.code}</span>
                <span className="text-ink">{c.title}</span>
                {c.level && (
                  <span className="text-xs text-ink-muted">{c.level}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Request new course */}
      <form
        onSubmit={requestAddCourse}
        className="space-y-3 rounded-2xl border border-border-light bg-card-light p-5"
      >
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <BookOpen size={16} className="text-teal" /> Request new course
        </h2>
        <p className="text-xs text-ink-muted">
          Admin must approve. After approval, students in{" "}
          <strong>{department || "your department"}</strong> get this as a free
          department course.
        </p>
        <input
          value={cCode}
          onChange={(e) => setCCode(e.target.value)}
          placeholder="Course code e.g. CSC101"
          className={field}
          required
        />
        <input
          value={cTitle}
          onChange={(e) => setCTitle(e.target.value)}
          placeholder="Course title"
          className={field}
          required
        />
        <select
          value={cLevel}
          onChange={(e) => setCLevel(e.target.value)}
          className={field}
        >
          {LEVELS.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
        <textarea
          value={cDesc}
          onChange={(e) => setCDesc(e.target.value)}
          rows={2}
          placeholder="Description (optional)"
          className={field}
        />
        <button
          type="submit"
          disabled={cBusy || !department}
          className="inline-flex items-center gap-2 rounded-xl bg-teal px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {cBusy ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Send size={15} />
          )}
          Submit course for admin approval
        </button>
      </form>

      {/* Upload material for a department course */}
      <form onSubmit={uploadMaterial} className="space-y-3 rounded-2xl border border-border-light bg-card-light p-5">
        <h2 className="text-sm font-semibold text-ink">Upload material for a department course</h2>
        <p className="text-xs text-ink-muted">Submit a file for admin approval. After approval it appears under the selected course.</p>
        <select value={matCourseId} onChange={(e) => setMatCourseId(e.target.value)} className={field} required>
          <option value="">Select course</option>
          {deptCourses.map((c) => (
            <option key={c.id} value={c.id}>{c.code} — {c.title}</option>
          ))}
        </select>
        <input value={matTitle} onChange={(e) => setMatTitle(e.target.value)} placeholder="Material title" className={field} required />
        <input type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,image/*" onChange={(e) => setMatFile(e.target.files?.[0] || null)} />
        {matProgress > 0 && matProgress < 100 && <p className="text-xs">Upload {matProgress}%</p>}
        <button type="submit" disabled={matBusy} className="inline-flex items-center gap-2 rounded-xl bg-teal px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {matBusy ? "Uploading…" : "Submit material for approval"}
        </button>
      </form>

      {/* Schedule class */}
      <form
        onSubmit={scheduleClass}
        className="space-y-4 rounded-2xl border border-border-light bg-card-light p-5"
      >
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <CalendarPlus size={16} className="text-teal" /> Schedule class
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs text-ink-muted">Title *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Week 5 — Tutorial"
              className={field}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-ink-muted">
              Course code (optional)
            </label>
            <input
              value={courseCode}
              onChange={(e) => setCourseCode(e.target.value)}
              placeholder="CSC101"
              className={field}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-ink-muted">Venue</label>
            <input
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              placeholder="LT1 / Zoom link"
              className={field}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-ink-muted">Start *</label>
            <input
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              className={field}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-ink-muted">End</label>
            <input
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              className={field}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs text-ink-muted">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className={field}
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={busy || !department}
          className="inline-flex items-center gap-2 rounded-xl bg-teal px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Send size={15} />
          )}
          Schedule & notify your level
        </button>
      </form>

      {/* My scheduled classes */}
      <div className="rounded-2xl border border-border-light bg-card-light p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
          <Bell size={16} className="text-teal" /> My scheduled classes
        </h2>
        {myClasses.length === 0 && (
          <p className="text-sm text-ink-muted">No classes scheduled yet.</p>
        )}
        <div className="space-y-2">
          {myClasses.map((ev) => {
            const start = ev.startsAt?.toDate?.() || ev.startsAt;
            return (
              <div
                key={ev.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border-light bg-surface-light px-3 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-ink">{ev.title}</p>
                  <p className="text-xs text-ink-muted">
                    {[
                      ev.courseCode,
                      start && new Date(start).toLocaleString(),
                      ev.venue,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => cancelClass(ev)}
                  className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  <Trash2 size={13} /> Cancel class
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* My requests (status + admin note) */}
      <div className="rounded-2xl border border-border-light bg-card-light p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
          <Inbox size={16} className="text-teal" /> My requests
        </h2>
        {myRequests.length === 0 && (
          <p className="text-sm text-ink-muted">No course/material requests yet.</p>
        )}
        <div className="space-y-2">
          {myRequests.map((r) => (
            <div
              key={r.id}
              className="rounded-xl border border-border-light bg-surface-light px-3 py-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-ink">{r.title}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    r.status === "approved"
                      ? "bg-teal-soft text-teal"
                      : r.status === "rejected"
                        ? "bg-red-50 text-red-600"
                        : "bg-amber-50 text-amber-700"
                  }`}
                >
                  {r.status || "pending"}
                </span>
              </div>
              {(r.reviewNote || r.adminNote) && (
                <p className="mt-2 text-xs text-ink-muted">
                  <strong>Admin:</strong> {r.reviewNote || r.adminNote}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
      <ScheduleClassModal
        open={showSchedule}
        onClose={(ok) => {
          setShowSchedule(false);
          if (ok) setMsg("Class scheduled. Students in your level will see it.");
        }}
        department={department}
        level={level}
        faculty={faculty}
        user={user}
        authorName={displayLabel(profile, user?.email || "Course Rep")}
      />
      <CreateAnnouncementModal
        open={showAnnounce}
        onClose={(ok) => {
          setShowAnnounce(false);
          if (ok) setMsg("Announcement posted to your department feed.");
        }}
        department={department}
        level={level}
        faculty={faculty}
        user={user}
        authorName={displayLabel(profile, user?.email || "Course Rep")}
      />
      <AiCourseImportModal
        open={showAiImport}
        onClose={() => setShowAiImport(false)}
        mode="request"
        defaultFaculty={faculty}
        defaultDepartment={department}
      />
    </div>
  );
}