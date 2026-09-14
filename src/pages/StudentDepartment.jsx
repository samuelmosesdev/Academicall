import { useEffect, useState, useRef, useCallback } from "react";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import {
  Building2,
  Calendar,
  CalendarPlus,
  BookOpen,
  Pin,
  MessageCircle,
  Send,
  Loader2,
  ExternalLink,
  BookmarkPlus,
  BookmarkCheck,
  Megaphone,
  Clock,
  MapPin,
  Lock,
} from "lucide-react";
import { db } from "../firebase/config";
import { classEventsApi, documentsApi, feedApi, materialSavesApi, usersApi } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import ScheduleClassModal from "../components/ScheduleClassModal";
import CreateAnnouncementModal from "../components/CreateAnnouncementModal";

const field =
  "w-full rounded-xl border border-border-light bg-card-light px-3 py-2 text-sm text-ink focus:border-teal focus:outline-none";

/** Reaction types: acknowledge (👍), haha (😂), love (❤️) */
const REACTIONS = [
  { type: "like", emoji: "👍", label: "Acknowledge" },
  { type: "haha", emoji: "😂", label: "Haha" },
  { type: "love", emoji: "❤️", label: "Love" },
];

function norm(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function levelsMatch(a, b) {
  const normalizedA = norm(a).replace(/\s*level\s*/g, "").trim();
  const normalizedB = norm(b).replace(/\s*level\s*/g, "").trim();
  return normalizedA === normalizedB && normalizedA !== "";
}

function deptsMatch(a, b) {
  return norm(a) === norm(b) && norm(a) !== "";
}

function matchesStudentLevel(itemLevel, studentLevel) {
  // Strict: only same level. Legacy docs with no level are hidden (not shared across levels).
  if (!studentLevel) return false;
  if (!itemLevel) return false;
  return levelsMatch(itemLevel, studentLevel);
}

/** Count reactions by type from an array of { uid, type } */
function countReactions(list) {
  const counts = { like: 0, haha: 0, love: 0 };
  (list || []).forEach((r) => {
    if (counts[r.type] !== undefined) counts[r.type] += 1;
  });
  return counts;
}

/** My current reaction type on an item, or null */
function myReaction(list, uid) {
  if (!uid || !list) return null;
  const found = list.find((r) => r.uid === uid);
  return found?.type || null;
}

export default function StudentDepartment() {
  const { user, profile, authMode } = useAuth();
  const department = profile?.department || "";
  const faculty = profile?.faculty || "";
  const level = profile?.level || "";

  const [classes, setClasses] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [posts, setPosts] = useState([]);
  const [savedIds, setSavedIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState({});
  const [commentBusy, setCommentBusy] = useState({});
  const [classCommentText, setClassCommentText] = useState({});
  const [classCommentBusy, setClassCommentBusy] = useState({});
  const [expandedClassComments, setExpandedClassComments] = useState({});
  const [saveBusy, setSaveBusy] = useState({});
  const [expandedComments, setExpandedComments] = useState({});
  const [hasCourseRep, setHasCourseRep] = useState(null); // null = loading
  const [showSchedule, setShowSchedule] = useState(false);
  const [showAnnounce, setShowAnnounce] = useState(false);
  const [toast, setToast] = useState("");

  const myRepDept =
    profile?.courseRepMeta?.department ||
    profile?.courseRepDepartment ||
    profile?.department ||
    "";
  const myRepLevel =
    profile?.courseRepMeta?.level ||
    profile?.courseRepLevel ||
    profile?.level ||
    "";

  const isRepHere =
    profile?.role === "courseRep" &&
    deptsMatch(myRepDept, department) &&
    levelsMatch(myRepLevel, level);

  // Is the signed-in user, or anyone else, the Course Rep for this scope?
  useEffect(() => {
    if (
      profile?.role === "courseRep" &&
      deptsMatch(myRepDept, department) &&
      levelsMatch(myRepLevel, level)
    ) {
      setHasCourseRep(true);
      return undefined;
    }

    if (!department || !level) {
      setHasCourseRep(false);
      return undefined;
    }

    if (authMode === "api") {
      let alive = true;
      usersApi
        .courseRepStatus?.(department, level)
        .then((res) => {
          if (alive) setHasCourseRep(Boolean(res?.hasCourseRep));
        })
        .catch(() => {
          if (alive) setHasCourseRep(false);
        });
      return () => { alive = false; };
    }
    const q = query(
      collection(db, "users"),
      where("department", "==", department)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const found = snap.docs.some((d) => {
          const u = d.data();
          if (u.role !== "courseRep") return false;
          const dep =
            u.courseRepMeta?.department ||
            u.courseRepDepartment ||
            u.department ||
            "";
          const lvl =
            u.courseRepLevel ||
            u.courseRepMeta?.level ||
            u.level ||
            "";
          return deptsMatch(dep, department) && levelsMatch(lvl, level);
        });
        setHasCourseRep(found);
      },
      () => setHasCourseRep(false)
    );
    return () => unsub();
  }, [department, level, authMode, profile?.role, myRepDept, myRepLevel]);

  useEffect(() => {
    if (authMode === "api") {
      let alive = true;
      classEventsApi.list().then(({ events = [] }) => alive && setClasses(events.filter((event) => event.department === department && matchesStudentLevel(event.level, level)))).catch(() => alive && setClasses([])).finally(() => alive && setLoading(false));
      return () => { alive = false; };
    }
    if (!department || !level) {
      setLoading(false);
      setClasses([]);
      return;
    }
    const q = query(
      collection(db, "classEvents"),
      where("department", "==", department)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((c) => matchesStudentLevel(c.level, level));
        list.sort((a, b) => {
          const ta = a.startsAt?.toDate?.() || a.startsAt || 0;
          const tb = b.startsAt?.toDate?.() || b.startsAt || 0;
          return new Date(ta) - new Date(tb);
        });
        setClasses(list);
      },
      () => setClasses([])
    );
    return () => unsub();
  }, [department, level, authMode]);

  useEffect(() => {
    if (authMode === "api") {
      let alive = true;
      if (!department || !level) return undefined;
      documentsApi.list().then(({ documents = [] }) => alive && setMaterials(documents.filter((item) => item.department === department && item.source === "courseRep" && matchesStudentLevel(item.level, level)))).catch(() => alive && setMaterials([]));
      return () => { alive = false; };
    }
    if (!department || !level) return;
    const q = query(
      collection(db, "documents"),
      where("department", "==", department),
      where("source", "==", "courseRep")
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((m) => matchesStudentLevel(m.level, level));
        list.sort((a, b) => {
          const ta = a.createdAt?.toDate?.() || a.createdAt || 0;
          const tb = b.createdAt?.toDate?.() || b.createdAt || 0;
          return new Date(tb) - new Date(ta);
        });
        setMaterials(list);
        setLoading(false);
      },
      () => {
        setMaterials([]);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [department, level, authMode]);

  useEffect(() => {
    if (authMode === "api") {
      let alive = true;
      if (!department || !level) return undefined;
      feedApi.list("course", `department=${encodeURIComponent(department)}`).then(({ posts = [] }) => alive && setPosts(posts.filter((item) => matchesStudentLevel(item.level, level)))).catch(() => alive && setPosts([]));
      return () => { alive = false; };
    }
    if (!department || !level) return;
    const q = query(
      collection(db, "coursePosts"),
      where("department", "==", department)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((p) => matchesStudentLevel(p.level, level));
        list.sort((a, b) => {
          if (a.pinned && !b.pinned) return -1;
          if (!a.pinned && b.pinned) return 1;
          const ta = a.createdAt?.toDate?.() || a.createdAt || 0;
          const tb = b.createdAt?.toDate?.() || b.createdAt || 0;
          return new Date(tb) - new Date(ta);
        });
        setPosts(list);
      },
      () => setPosts([])
    );
    return () => unsub();
  }, [department, level, authMode]);

  useEffect(() => {
    if (!user) return;
    if (authMode === "api") {
      let alive = true;
      materialSavesApi.list().then(({ saves = [] }) => alive && setSavedIds(new Set(saves.map((item) => item.materialId)))).catch(() => alive && setSavedIds(new Set()));
      return () => { alive = false; };
    }
    const q = query(
      collection(db, "materialSaves"),
      where("userId", "==", user.uid)
    );
    const unsub = onSnapshot(q, (snap) => {
      const ids = new Set();
      snap.docs.forEach((d) => {
        const mid = d.data().materialId;
        if (mid) ids.add(mid);
      });
      setSavedIds(ids);
    });
    return () => unsub();
  }, [user, authMode]);

  async function saveMaterial(mat) {
    if (!user || savedIds.has(mat.id)) return;
    setSaveBusy((p) => ({ ...p, [mat.id]: true }));
    try {
      if (authMode === "api") {
        await materialSavesApi.create({
          materialId: mat.id,
          title: mat.title || "Untitled",
          url: mat.fileUrl || mat.url || null,
          meta: { ...mat, department: mat.department || department, faculty: mat.faculty || faculty, courseCode: mat.courseCode || "GENERAL" },
        });
        setSavedIds((current) => new Set(current).add(mat.id));
        return;
      }
      await addDoc(collection(db, "materialSaves"), {
        userId: user.uid,
        materialId: mat.id,
        title: mat.title || "Untitled",
        description: mat.description || null,
        fileUrl: mat.fileUrl || mat.url || null,
        courseCode: (mat.courseCode || "GENERAL").toUpperCase(),
        courseTitle: mat.courseTitle || null,
        department: mat.department || department,
        faculty: mat.faculty || faculty,
        savedAt: serverTimestamp(),
        source: "courseRep",
      });
    } catch (e) {
      alert(e.message || "Could not save material.");
    } finally {
      setSaveBusy((p) => ({ ...p, [mat.id]: false }));
    }
  }

  async function addComment(postId) {
    const text = (commentText[postId] || "").trim();
    if (!text || !user) return;
    setCommentBusy((p) => ({ ...p, [postId]: true }));
    try {
      const post = posts.find((p) => p.id === postId);
      const comments = Array.isArray(post?.comments) ? [...post.comments] : [];
      comments.push({
        id: `${Date.now()}_${user.uid}`,
        text,
        authorUid: user.uid,
        authorName: profile?.nickname || profile?.name || user.email || "Student",
        authorPhoto: profile?.photoUrl || profile?.avatarUrl || profile?.photoURL || null,
        authorRole: profile?.role || "user",
        authorPlan: profile?.plan || null,
        authorSubscription: profile?.subscription || null,
        createdAt: new Date().toISOString(),
        reactions: [],
      });
      if (authMode === "api") await feedApi.update("course", postId, { comments });
      else await updateDoc(doc(db, "coursePosts", postId), { comments });
      setCommentText((p) => ({ ...p, [postId]: "" }));
      setExpandedComments((p) => ({ ...p, [postId]: true }));
    } catch (e) {
      alert(e.message || "Could not post comment.");
    } finally {
      setCommentBusy((p) => ({ ...p, [postId]: false }));
    }
  }

  async function addClassComment(classId) {
    const text = (classCommentText[classId] || "").trim();
    if (!text || !user) return;
    setClassCommentBusy((p) => ({ ...p, [classId]: true }));
    try {
      const ev = classes.find((c) => c.id === classId);
      const comments = Array.isArray(ev?.comments) ? [...ev.comments] : [];
      comments.push({
        id: `${Date.now()}_${user.uid}`,
        text,
        authorUid: user.uid,
        authorName: profile?.nickname || profile?.name || user.email || "Student",
        authorPhoto: profile?.photoUrl || profile?.avatarUrl || profile?.photoURL || null,
        authorRole: profile?.role || "user",
        authorPlan: profile?.plan || null,
        authorSubscription: profile?.subscription || null,
        createdAt: new Date().toISOString(),
        reactions: [],
      });
      await updateDoc(doc(db, "classEvents", classId), { comments });
      setClassCommentText((p) => ({ ...p, [classId]: "" }));
      setExpandedClassComments((p) => ({ ...p, [classId]: true }));
    } catch (e) {
      alert(e.message || "Could not post comment.");
    } finally {
      setClassCommentBusy((p) => ({ ...p, [classId]: false }));
    }
  }

  /**
   * Toggle a reaction on a post (coursePosts) or class event (classEvents).
   * One reaction per user — clicking the same type removes it; clicking another switches.
   */
  async function togglePostReaction(collectionName, docId, reactionType) {
    if (!user) return;
    try {
      const list =
        collectionName === "coursePosts"
          ? posts
          : collectionName === "classEvents"
            ? classes
            : materials;
      const item = list.find((x) => x.id === docId);
      if (!item) return;
      let reactions = Array.isArray(item.reactions) ? [...item.reactions] : [];
      const existing = reactions.findIndex((r) => r.uid === user.uid);
      if (existing >= 0) {
        if (reactions[existing].type === reactionType) {
          reactions.splice(existing, 1); // remove
        } else {
          reactions[existing] = {
            uid: user.uid,
            type: reactionType,
            name: profile?.name || user.email || "Student",
          };
        }
      } else {
        reactions.push({
          uid: user.uid,
          type: reactionType,
          name: profile?.name || user.email || "Student",
        });
      }
      if (authMode === "api") await feedApi.update("course", docId, { reactions });
      else await updateDoc(doc(db, collectionName, docId), { reactions });
    } catch (e) {
      alert(e.message || "Could not react.");
    }
  }

  /**
   * Toggle a reaction on a comment inside a post or class event.
   */
  async function toggleCommentReaction(
    collectionName,
    docId,
    commentId,
    reactionType
  ) {
    if (!user) return;
    try {
      const list =
        collectionName === "coursePosts"
          ? posts
          : collectionName === "classEvents"
            ? classes
            : [];
      const item = list.find((x) => x.id === docId);
      if (!item) return;
      const comments = Array.isArray(item.comments) ? [...item.comments] : [];
      const idx = comments.findIndex((c) => c.id === commentId);
      if (idx < 0) return;
      const comment = { ...comments[idx] };
      let reactions = Array.isArray(comment.reactions)
        ? [...comment.reactions]
        : [];
      const existing = reactions.findIndex((r) => r.uid === user.uid);
      if (existing >= 0) {
        if (reactions[existing].type === reactionType) {
          reactions.splice(existing, 1);
        } else {
          reactions[existing] = {
            uid: user.uid,
            type: reactionType,
            name: profile?.name || user.email || "Student",
          };
        }
      } else {
        reactions.push({
          uid: user.uid,
          type: reactionType,
          name: profile?.name || user.email || "Student",
        });
      }
      comment.reactions = reactions;
      comments[idx] = comment;
      if (authMode === "api") await feedApi.update("course", docId, { comments });
      else await updateDoc(doc(db, collectionName, docId), { comments });
    } catch (e) {
      alert(e.message || "Could not react to comment.");
    }
  }

  /**
   * Reaction summary + long-press picker.
   * Shows common emojis + total count. Long-press (or right-click) opens a
   * floating picker; slide/tap preferred reaction, then it closes.
   */
  function ReactionBar({ reactions, onReact, size = "md" }) {
    const [open, setOpen] = useState(false);
    const [hoverType, setHoverType] = useState(null);
    const timerRef = useRef(null);
    const rootRef = useRef(null);
    const counts = countReactions(reactions);
    const mine = myReaction(reactions, user?.uid);
    const total = (reactions || []).length;

    // Emojis that have at least 1 reaction, ordered by popularity
    const present = REACTIONS.filter((r) => counts[r.type] > 0).sort(
      (a, b) => counts[b.type] - counts[a.type]
    );

    const clearTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const startHold = (e) => {
      e.preventDefault();
      clearTimer();
      timerRef.current = setTimeout(() => {
        setOpen(true);
        setHoverType(mine || "like");
      }, 320); // short long-press
    };

    const endHold = () => {
      clearTimer();
    };

    const pick = (type) => {
      onReact(type);
      setOpen(false);
      setHoverType(null);
    };

    // Close when clicking outside
    useEffect(() => {
      if (!open) return;
      const onDoc = (e) => {
        if (rootRef.current && !rootRef.current.contains(e.target)) {
          setOpen(false);
          setHoverType(null);
        }
      };
      document.addEventListener("pointerdown", onDoc);
      return () => document.removeEventListener("pointerdown", onDoc);
    }, [open]);

    useEffect(() => () => clearTimer(), []);

    const isSm = size === "sm";

    return (
      <div ref={rootRef} className="relative inline-flex items-center gap-2">
        {/* Summary chip — shows common reactions + total */}
        <button
          type="button"
          title={mine ? "Long-press to change reaction" : "Long-press to react"}
          onPointerDown={startHold}
          onPointerUp={endHold}
          onPointerLeave={endHold}
          onPointerCancel={endHold}
          onContextMenu={(e) => {
            e.preventDefault();
            setOpen(true);
            setHoverType(mine || "like");
          }}
          onClick={() => {
            // Quick tap: toggle own reaction or open picker if none
            if (mine) {
              onReact(mine); // remove
            } else {
              setOpen(true);
              setHoverType("like");
            }
          }}
          className={`inline-flex items-center gap-1.5 rounded-full border transition select-none active:scale-95 ${
            isSm ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm"
          } ${
            mine
              ? "border-teal/40 bg-teal-soft text-teal"
              : "border-border-light bg-card-light text-ink-muted hover:border-teal/30 hover:text-ink"
          }`}
        >
          {present.length > 0 ? (
            <>
              <span className="flex items-center -space-x-0.5">
                {present.slice(0, 3).map((r) => (
                  <span key={r.type} className="leading-none">
                    {r.emoji}
                  </span>
                ))}
              </span>
              <span className="tabular-nums font-semibold text-[11px]">
                {total}
              </span>
            </>
          ) : (
            <span className="flex items-center gap-1 opacity-70">
              <span>👍</span>
              <span className="text-[11px] font-medium">React</span>
            </span>
          )}
        </button>

        {/* Long-press / popup picker */}
        {open && (
          <div
            className="absolute bottom-full left-0 z-30 mb-2 flex items-center gap-1 rounded-full border border-border-light bg-card-light px-2 py-1.5 shadow-lg animate-stitch-in"
            style={{ minWidth: "max-content" }}
            onPointerLeave={() => setHoverType(null)}
          >
            {REACTIONS.map(({ type, emoji, label }) => {
              const active = hoverType === type || mine === type;
              return (
                <button
                  key={type}
                  type="button"
                  title={label}
                  onPointerEnter={() => setHoverType(type)}
                  onClick={() => pick(type)}
                  className={`flex h-10 w-10 items-center justify-center rounded-full text-xl transition-transform duration-150 ${
                    active
                      ? "scale-125 bg-teal-soft"
                      : "scale-100 hover:scale-110 hover:bg-bg-panel-alt"
                  }`}
                >
                  {emoji}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  if (!department) {
    return (
      <div className="rounded-2xl border border-border-light bg-card-light p-8 text-center">
        <Building2 className="mx-auto mb-3 text-ink-muted opacity-50" size={36} />
        <p className="text-sm font-medium text-ink">No department on your profile</p>
        <p className="mt-1 text-xs text-ink-muted">
          Complete your profile with faculty &amp; department to see class schedules and
          course-rep materials.
        </p>
      </div>
    );
  }


  if (!level) {
    return (
      <div className="rounded-2xl border border-border-light bg-card-light p-8 text-center">
        <Lock className="mx-auto mb-3 text-ink-muted opacity-50" size={36} />
        <p className="text-sm font-medium text-ink">Level not set on your profile</p>
        <p className="mt-1 text-xs text-ink-muted">
          Complete your profile with your level so we can show the correct Course Rep group.
        </p>
      </div>
    );
  }

  if (hasCourseRep === false && !isRepHere) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-border-light bg-card-light p-8 text-center shadow-sm">
        <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-bg-panel-alt text-ink-muted">
          <Lock size={28} />
        </span>
        <p className="font-display text-base font-semibold text-ink">No Course Rep yet</p>
        <p className="mt-2 text-sm text-ink-muted leading-relaxed">
          There is no Course Rep assigned for{" "}
          <strong className="text-ink">{department}</strong>
          {level ? (
            <>
              {" "}
              · <strong className="text-ink">{level}</strong>
            </>
          ) : null}
          .
        </p>
        <p className="mt-3 text-xs text-ink-muted">
          Schedules, announcements, and materials stay locked until Admin assigns a Course Rep
          for your department and level.
        </p>
      </div>
    );
  }

  if (hasCourseRep === null || loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-ink-muted">
        <Loader2 className="animate-spin" size={16} /> Loading your class group…
      </div>
    );
  }

  const upcoming = classes.filter((c) => {
    const start = c.startsAt?.toDate?.() || c.startsAt;
    if (!start) return true;
    return new Date(start) >= new Date(Date.now() - 2 * 60 * 60 * 1000);
  });

  function flash(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 4000);
  }

  return (
    <div className="space-y-8 animate-stitch-in max-w-4xl mx-auto">
      {/* Header — Stitch Departmental Hub style */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-ink-muted">
            Departmental Hub
          </p>
          <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-ink flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-soft text-teal">
              <Building2 size={18} />
            </span>
            {department}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {faculty ? `${faculty} · ` : ""}
            {level ? `${level} · ` : ""}
            Only your department & level
          </p>
        </div>
        {isRepHere && (
          <div className="rounded-full bg-teal-soft px-3 py-1 text-xs font-semibold text-teal">
            Course Representative
          </div>
        )}
      </div>

      {toast && (
        <p className="rounded-2xl border border-teal/20 bg-teal-soft px-4 py-2.5 text-sm font-medium text-teal shadow-sm">
          {toast}
        </p>
      )}

      {/* Course Rep Quick Actions — Bento / glass (Stitch) */}
      {isRepHere && (
        <section>
          <h3 className="mb-3 px-1 text-[11px] font-bold uppercase tracking-wider text-ink-muted">
            Rep Quick Actions
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <button
              type="button"
              onClick={() => setShowAnnounce(true)}
              className="card-stitch flex flex-col items-center justify-center gap-2 rounded-2xl p-4 transition hover:bg-white/80 active:scale-[0.98] dark:hover:bg-bg-elevated"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-pink-500/10 text-pink-500">
                <Megaphone size={20} />
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wide text-ink">
                Announce
              </span>
            </button>
            <button
              type="button"
              onClick={() => setShowSchedule(true)}
              className="card-stitch flex flex-col items-center justify-center gap-2 rounded-2xl p-4 transition hover:bg-white/80 active:scale-[0.98] dark:hover:bg-bg-elevated"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-orange-500/10 text-orange-500">
                <CalendarPlus size={20} />
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wide text-ink">
                Schedule
              </span>
            </button>
            <button
              type="button"
              onClick={() => setShowAnnounce(true)}
              className="col-span-2 flex items-center justify-center gap-3 rounded-2xl bg-teal p-4 text-white shadow-md shadow-teal/20 transition hover:brightness-105 active:scale-[0.98] sm:col-span-2"
            >
              <Megaphone size={20} />
              <span className="text-sm font-bold">New Post</span>
            </button>
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 px-1 font-display text-base font-semibold text-ink">
          <Calendar size={16} className="text-teal" />
          Scheduled classes
        </h2>
        {loading && (
          <p className="text-sm text-ink-muted flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" /> Loading…
          </p>
        )}
        {!loading && upcoming.length === 0 && (
          <div className="rounded-xl border border-border-light bg-card-light px-4 py-8 text-center text-sm text-ink-muted">
            No upcoming classes scheduled for your department.
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          {upcoming.map((ev) => {
            const start = ev.startsAt?.toDate?.() || ev.startsAt;
            const end = ev.endsAt?.toDate?.() || ev.endsAt;
            const comments = Array.isArray(ev.comments) ? ev.comments : [];
            const open = expandedClassComments[ev.id];
            return (
              <div
                key={ev.id}
                className="card-stitch relative overflow-hidden rounded-2xl p-5 pl-6"
              >
                <div className="absolute left-0 top-0 h-full w-1.5 rounded-l-2xl bg-teal" />
                <p className="text-sm font-semibold text-ink">{ev.title}</p>
                {ev.courseCode && (
                  <p className="text-xs font-medium text-teal mt-0.5">{ev.courseCode}</p>
                )}
                <div className="mt-2 space-y-1 text-xs text-ink-muted">
                  {start && (
                    <p className="flex items-center gap-1.5">
                      <Clock size={12} />{" "}
                      {new Date(start).toLocaleString()}
                      {end ? ` – ${new Date(end).toLocaleTimeString()}` : ""}
                    </p>
                  )}
                  {ev.venue && (
                    <p className="flex items-center gap-1.5">
                      <MapPin size={12} /> {ev.venue}
                    </p>
                  )}
                  {ev.notes && <p className="mt-1 text-ink-muted">{ev.notes}</p>}
                </div>

                {/* Class reactions */}
                <div className="mt-3">
                  <ReactionBar
                    reactions={ev.reactions}
                    onReact={(type) =>
                      togglePostReaction("classEvents", ev.id, type)
                    }
                  />
                </div>

                {/* Class comments */}
                <div className="mt-3 border-t border-border-light pt-2.5">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedClassComments((p) => ({
                        ...p,
                        [ev.id]: !p[ev.id],
                      }))
                    }
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-teal hover:underline"
                  >
                    <MessageCircle size={13} />
                    {comments.length} comment{comments.length !== 1 ? "s" : ""}
                  </button>

                  {open && (
                    <div className="mt-2.5 space-y-2">
                      {comments.length === 0 && (
                        <p className="text-xs text-ink-muted">No comments yet. Be first!</p>
                      )}
                      {comments.map((c) => (
                        <div
                          key={c.id}
                          className="rounded-xl bg-bg-panel-alt/50 px-3 py-2.5"
                        >
                          <p className="text-xs font-semibold text-ink">
                            {c.authorName || "Student"}
                          </p>
                          <p className="mt-0.5 text-xs text-ink-muted whitespace-pre-wrap">
                            {c.text}
                          </p>
                          {c.createdAt && (
                            <p className="mt-1 text-[10px] text-ink-muted">
                              {new Date(c.createdAt).toLocaleString()}
                            </p>
                          )}
                          <div className="mt-1.5">
                            <ReactionBar
                              size="sm"
                              reactions={c.reactions}
                              onReact={(type) =>
                                toggleCommentReaction(
                                  "classEvents",
                                  ev.id,
                                  c.id,
                                  type
                                )
                              }
                            />
                          </div>
                        </div>
                      ))}
                      <div className="flex gap-2 pt-1">
                        <input
                          className={field}
                          placeholder="Write a comment…"
                          value={classCommentText[ev.id] || ""}
                          onChange={(e) =>
                            setClassCommentText((p) => ({
                              ...p,
                              [ev.id]: e.target.value,
                            }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              addClassComment(ev.id);
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => addClassComment(ev.id)}
                          disabled={classCommentBusy[ev.id]}
                          className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-teal px-3 py-2 text-xs font-semibold text-white hover:bg-teal-dark disabled:opacity-60"
                        >
                          {classCommentBusy[ev.id] ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Send size={14} />
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <div className="mb-1 flex items-center justify-between px-1">
          <h2 className="font-display text-base font-semibold text-ink flex items-center gap-2">
            <Megaphone size={16} className="text-teal" />
            Department Feed
          </h2>
        </div>
        {posts.length === 0 && (
          <div className="rounded-xl border border-border-light bg-card-light px-4 py-8 text-center text-sm text-ink-muted">
            No announcements yet from your Course Rep.
          </div>
        )}
        <div className="flex flex-col gap-5">
          {posts.map((post) => {
            const comments = Array.isArray(post.comments) ? post.comments : [];
            const open = expandedComments[post.id];
            const accent = post.pinned
              ? "bg-pink-500"
              : post.courseCode
                ? "bg-orange-500"
                : "bg-violet-500";
            return (
              <article
                key={post.id}
                className="card-stitch relative overflow-hidden rounded-3xl p-6 pl-7 group"
              >
                <div className={`absolute left-0 top-0 h-full w-1.5 rounded-l-3xl ${accent}`} />
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {post.pinned && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-pink-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-pink-600 border border-pink-500/20">
                        <Pin size={10} /> Pinned
                      </span>
                    )}
                    {post.courseCode && (
                      <span className="rounded-full bg-orange-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-orange-600 border border-orange-500/20">
                        {post.courseCode}
                      </span>
                    )}
                  </div>
                </div>
                <h3 className="mt-2 text-base font-semibold text-ink">{post.title}</h3>
                <p className="mt-1.5 text-sm text-ink-muted whitespace-pre-wrap leading-relaxed">
                  {post.body}
                </p>
                <p className="mt-2 text-[11px] text-ink-muted">
                  {post.authorName || "Course Rep"} ·{" "}
                  {post.createdAt?.toDate
                    ? post.createdAt.toDate().toLocaleString()
                    : ""}
                </p>

                {/* Post reactions */}
                <div className="mt-3">
                  <ReactionBar
                    reactions={post.reactions}
                    onReact={(type) =>
                      togglePostReaction("coursePosts", post.id, type)
                    }
                  />
                </div>

                <div className="mt-4 border-t border-border-light pt-3">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedComments((p) => ({
                        ...p,
                        [post.id]: !p[post.id],
                      }))
                    }
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-teal hover:underline"
                  >
                    <MessageCircle size={13} />
                    {comments.length} comment{comments.length !== 1 ? "s" : ""}
                  </button>

                  {open && (
                    <div className="mt-3 space-y-2">
                      {comments.length === 0 && (
                        <p className="text-xs text-ink-muted">No comments yet. Be first!</p>
                      )}
                      {comments.map((c) => (
                        <div
                          key={c.id}
                          className="rounded-xl bg-bg-panel-alt/50 px-3 py-2.5"
                        >
                          <p className="text-xs font-semibold text-ink">
                            {c.authorName || "Student"}
                          </p>
                          <p className="mt-0.5 text-xs text-ink-muted whitespace-pre-wrap">
                            {c.text}
                          </p>
                          {c.createdAt && (
                            <p className="mt-1 text-[10px] text-ink-muted">
                              {new Date(c.createdAt).toLocaleString()}
                            </p>
                          )}
                          {/* React to another student's comment */}
                          <div className="mt-1.5">
                            <ReactionBar
                              size="sm"
                              reactions={c.reactions}
                              onReact={(type) =>
                                toggleCommentReaction(
                                  "coursePosts",
                                  post.id,
                                  c.id,
                                  type
                                )
                              }
                            />
                          </div>
                        </div>
                      ))}
                      <div className="flex gap-2 pt-1">
                        <input
                          className={field}
                          placeholder="Write a comment…"
                          value={commentText[post.id] || ""}
                          onChange={(e) =>
                            setCommentText((p) => ({
                              ...p,
                              [post.id]: e.target.value,
                            }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              addComment(post.id);
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => addComment(post.id)}
                          disabled={commentBusy[post.id]}
                          className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-teal px-3 py-2 text-xs font-semibold text-white hover:bg-teal-dark disabled:opacity-60"
                        >
                          {commentBusy[post.id] ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Send size={14} />
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-base font-semibold text-ink flex items-center gap-2 px-1">
          <BookOpen size={16} className="text-teal" />
          Course materials
        </h2>
        {materials.length === 0 && (
          <div className="card-stitch rounded-2xl px-4 py-8 text-center text-sm text-ink-muted">
            No materials uploaded by your Course Rep yet.
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          {materials.map((mat) => {
            const saved = savedIds.has(mat.id);
            return (
              <div
                key={mat.id}
                className="card-stitch relative overflow-hidden rounded-2xl p-5 pl-6 flex flex-col"
              >
                <div className="absolute left-0 top-0 h-full w-1.5 rounded-l-2xl bg-orange-500" />
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold text-orange-600">
                      {mat.courseCode || "—"}
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-ink">
                      {mat.title}
                    </p>
                  </div>
                </div>
                {mat.description && (
                  <p className="mt-2 text-xs text-ink-muted line-clamp-3">
                    {mat.description}
                  </p>
                )}
                <div className="mt-3">
                  <ReactionBar
                    reactions={mat.reactions}
                    onReact={(type) =>
                      togglePostReaction("documents", mat.id, type)
                    }
                  />
                </div>
                <div className="mt-auto pt-3 flex flex-wrap gap-2">
                  {(mat.fileUrl || mat.url) && (
                    <a
                      href={mat.fileUrl || mat.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg border border-border-light px-2.5 py-1.5 text-xs font-medium text-ink hover:border-teal hover:text-teal"
                    >
                      <ExternalLink size={12} /> Read
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => saveMaterial(mat)}
                    disabled={saved || saveBusy[mat.id]}
                    className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                      saved
                        ? "bg-teal-soft text-teal"
                        : "border border-border-light text-ink hover:border-teal hover:text-teal"
                    } disabled:opacity-70`}
                  >
                    {saveBusy[mat.id] ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : saved ? (
                      <BookmarkCheck size={12} />
                    ) : (
                      <BookmarkPlus size={12} />
                    )}
                    {saved ? "Saved" : "Save to Materials"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Quick composers (Course Rep only) */}
      <ScheduleClassModal
        open={showSchedule}
        onClose={(created) => {
          setShowSchedule(false);
          if (created) flash("Class scheduled — students can see it now.");
        }}
        department={department}
        level={level}
        faculty={faculty}
        user={user}
        authorName={profile?.name || user?.email}
      />
      <CreateAnnouncementModal
        open={showAnnounce}
        onClose={(created) => {
          setShowAnnounce(false);
          if (created) flash("Announcement posted.");
        }}
        department={department}
        level={level}
        faculty={faculty}
        user={user}
        authorName={profile?.name || user?.email}
      />
    </div>
  );
}
