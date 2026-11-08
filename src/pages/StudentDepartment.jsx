import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2,
  Calendar,
  Loader2,
  Clock,
  Lock,
  Settings2,
  Users,
  XCircle,
} from "lucide-react";
import { classEventsApi, departmentApi, documentsApi, feedApi, materialSavesApi, usersApi } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import ScheduleClassModal from "../components/ScheduleClassModal";
import CreateAnnouncementModal from "../components/CreateAnnouncementModal";
import { getAcademicDepartment, getAcademicProgram, getAcademicScope, getCourseRepProgram, matchesAcademicScope } from "../lib/academicScope";
import { useRealtime } from "../lib/realtime";
import {
  ClassDateBlock,
  CommentThread,
  EmptyFeed,
  FeedCard,
  FileRow,
  FilterTabs,
  PostBody,
  ReactionBar,
  RepComposer,
  relTime,
  safeName,
  toMillis,
} from "../components/programme/ProgrammeFeed";

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
  if (!studentLevel) return false;
  if (!itemLevel) return true;
  return levelsMatch(itemLevel, studentLevel);
}

function feedAuthorName(post) {
  const name = post.authorName || post.createdByName;
  return name && !name.includes("@") ? name : "Course Rep";
}

export default function StudentDepartment() {
  const navigate = useNavigate();
  const { user, profile, authMode } = useAuth();
  // Hub is scoped by PROGRAM (degree programme), not the broad department.
  // Backend APIs still use a string field named "department" — we pass the program there
  // so class groups, materials, and membership are per-program.
  const program = getAcademicProgram(profile);
  const departmentName = getAcademicDepartment(profile);
  // Scope key used for API filters / membership / course-rep matching
  const department = getAcademicScope(profile);
  const faculty = profile?.faculty || "";
  const level = profile?.level || "";
  const hubTitle = program || "Your programme";
  const hubSubtitleParts = [
    faculty || null,
    departmentName && departmentName !== program ? departmentName : null,
    level || null,
  ].filter(Boolean);

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
  const [feedFilter, setFeedFilter] = useState("all"); // all | updates | classes | materials
  const [membership, setMembership] = useState(null);
  const [membershipLoading, setMembershipLoading] = useState(true);
  const [membershipBusy, setMembershipBusy] = useState(false);
  const [membershipMessage, setMembershipMessage] = useState("");

  useEffect(() => {
    if (authMode !== "api" || !department) {
      setMembershipLoading(false);
      return undefined;
    }
    let alive = true;
    setMembershipLoading(true);
    departmentApi.me(department)
      .then((response) => {
        if (!alive) return;
        setMembership(response.membership || null);
        setMembershipLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        setMembership(null);
        setMembershipLoading(false);
      });
    return () => { alive = false; setMembershipLoading(false); };
  }, [authMode, department]);

  async function requestMembership() {
    setMembershipBusy(true);
    setMembershipMessage("");
    try {
      if (!program) throw new Error("Select an academic program before requesting membership.");
      const response = await departmentApi.join({ program, faculty, level });
      setMembership(response.membership || null);
      setMembershipMessage(response.message || "Request sent.");
    } catch (err) {
      setMembershipMessage(err.message || "Could not send join request.");
    } finally {
      setMembershipBusy(false);
    }
  }

  const myRepDept = getCourseRepProgram(profile);
  const myRepLevel =
    profile?.courseRepMeta?.level || "";

  const isRepHere =
    profile?.role === "courseRep" &&
    deptsMatch(myRepDept, department) &&
    levelsMatch(myRepLevel, level);

  // Is the signed-in user, or anyone else, the Course Rep for this scope?
  useEffect(() => {
    if (authMode !== "api") {
      setHasCourseRep(null);
      return undefined;
    }

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

    let alive = true;
    usersApi
      .courseRepStatus?.(program, level)
      .then((res) => {
        if (alive) setHasCourseRep(Boolean(res?.hasCourseRep));
      })
      .catch(() => {
        if (alive) setHasCourseRep(false);
      });
    return () => { alive = false; };
  }, [department, program, level, authMode, profile?.role, myRepDept, myRepLevel]);

  useEffect(() => {
    if (authMode !== "api") {
      setLoading(false);
      setClasses([]);
      return undefined;
    }

    let alive = true;
    classEventsApi.list()
      .then(({ events = [] }) => alive && setClasses(events.filter((event) => matchesAcademicScope(event.program || event.department, profile) && matchesStudentLevel(event.level, level))))
      .catch(() => alive && setClasses([]))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [department, program, level, authMode, profile]);

  useEffect(() => {
    if (authMode !== "api") {
      setMaterials([]);
      return undefined;
    }

    let alive = true;
    if (!program || !level) {
      setMaterials([]);
      return undefined;
    }
    documentsApi.list()
      .then(({ documents = [] }) => alive && setMaterials(documents.filter((item) => matchesAcademicScope(item.program || item.department, profile) && item.source === "courseRep" && matchesStudentLevel(item.level, level))))
      .catch(() => alive && setMaterials([]));
    return () => { alive = false; };
  }, [department, program, level, authMode, profile]);

  useEffect(() => {
    if (authMode !== "api") {
      setPosts([]);
      return undefined;
    }

    let alive = true;
    if (!program || !level) {
      setPosts([]);
      return undefined;
    }
    feedApi.list("course", `program=${encodeURIComponent(program)}`)
      .then(({ posts = [] }) => alive && setPosts(posts.filter((item) => matchesStudentLevel(item.level, level))))
      .catch(() => alive && setPosts([]));
    return () => { alive = false; };
  }, [program, department, level, authMode]);

  useRealtime(["programme.post", "programme.class", "programme.material", "reconnected", "poll"], (_data, eventType) => {
    if (eventType === "programme.class" || eventType === "reconnected" || eventType === "poll") {
      classEventsApi.list()
        .then(({ events = [] }) => setClasses(events.filter((event) => matchesAcademicScope(event.program || event.department, profile) && matchesStudentLevel(event.level, level))))
        .catch((error) => console.warn("Could not refresh programme classes after live update:", error));
    }
    if (eventType === "programme.post" || eventType === "reconnected" || eventType === "poll") {
      feedApi.list("course", `program=${encodeURIComponent(program)}`)
        .then(({ posts = [] }) => setPosts(posts.filter((post) => matchesStudentLevel(post.level, level))))
        .catch((error) => console.warn("Could not refresh programme posts after live update:", error));
    }
    if (eventType === "programme.material" || eventType === "reconnected" || eventType === "poll") {
      documentsApi.list()
        .then(({ documents = [] }) => setMaterials(documents.filter((item) => matchesAcademicScope(item.program || item.department, profile) && item.source === "courseRep" && matchesStudentLevel(item.level, level))))
        .catch((error) => console.warn("Could not refresh programme materials after live update:", error));
    }
  });

  useEffect(() => {
    if (!user || authMode !== "api") {
      setSavedIds(new Set());
      return undefined;
    }

    let alive = true;
    materialSavesApi.list()
      .then(({ saves = [] }) => alive && setSavedIds(new Set(saves.map((item) => item.materialId))))
      .catch(() => alive && setSavedIds(new Set()));
    return () => { alive = false; };
  }, [user, authMode]);

  async function saveMaterial(mat) {
    if (!user || authMode !== "api" || savedIds.has(mat.id)) return;
    setSaveBusy((p) => ({ ...p, [mat.id]: true }));
    try {
      await materialSavesApi.create({
        materialId: mat.id,
        title: mat.title || "Untitled",
        url: mat.fileUrl || mat.url || undefined,
        meta: {
          description: mat.description || null,
          fileSize: mat.fileSize || null,
          source: mat.source || null,
          department: mat.department || department,
          faculty: mat.faculty || faculty,
          level: mat.level || level,
          courseCode: mat.course?.code || mat.courseCode || "GENERAL",
          courseTitle: mat.course?.title || mat.courseTitle || "",
          fileName: mat.fileName || mat.title || "material",
          fileUrl: mat.fileUrl || mat.url || null,
        },
      });
      setSavedIds((current) => new Set(current).add(mat.id));
    } catch (e) {
      alert(e.message || "Could not save material.");
    } finally {
      setSaveBusy((p) => ({ ...p, [mat.id]: false }));
    }
  }

  async function addComment(postId) {
    const text = (commentText[postId] || "").trim();
    if (!text || !user || authMode !== "api") return;
    setCommentBusy((p) => ({ ...p, [postId]: true }));
    try {
      const post = posts.find((p) => p.id === postId);
      if (!post) return;
      const { post: updated } = await feedApi.comment("course", postId, text);
      setPosts((current) => current.map((item) => item.id === postId ? updated : item));
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
    if (!text || !user || authMode !== "api") return;
    setClassCommentBusy((p) => ({ ...p, [classId]: true }));
    try {
      const ev = classes.find((c) => c.id === classId);
      if (!ev) return;
      const { event: updated } = await classEventsApi.comment(classId, text);
      setClasses((current) => current.map((item) => item.id === classId ? updated : item));
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
    if (!user || authMode !== "api") return;
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
      if (collectionName === "classEvents") {
        const { event: updated } = await classEventsApi.react(docId, reactionType);
        setClasses((current) => current.map((entry) => entry.id === docId ? updated : entry));
      } else if (collectionName === "coursePosts") {
        const { post: updated } = await feedApi.react("course", docId, reactionType);
        setPosts((current) => current.map((entry) => entry.id === docId ? updated : entry));
      } else {
        const { document: updated } = await documentsApi.react(docId, reactionType);
        setMaterials((current) => current.map((entry) => entry.id === docId ? updated : entry));
      }
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
    if (!user || authMode !== "api") return;
    try {
      const list =
        collectionName === "coursePosts"
          ? posts
          : collectionName === "classEvents"
            ? classes
            : [];
      const item = list.find((x) => x.id === docId);
      if (!item) return;
      if (!item.comments?.some((comment) => comment.id === commentId)) return;
      if (collectionName === "classEvents") {
        const { event: updated } = await classEventsApi.reactComment(docId, commentId, reactionType);
        setClasses((current) => current.map((entry) => entry.id === docId ? updated : entry));
      } else {
        const { post: updated } = await feedApi.reactComment("course", docId, commentId, reactionType);
        setPosts((current) => current.map((entry) => entry.id === docId ? updated : entry));
      }
    } catch (e) {
      alert(e.message || "Could not react to comment.");
    }
  }

  if (!department) {
    return (
      <div className="rounded-2xl border border-border-light bg-card-light p-8 text-center">
        <Building2 className="mx-auto mb-3 text-ink-muted opacity-50" size={36} />
        <p className="text-sm font-medium text-ink">No programme on your profile</p>
        <p className="mt-1 text-xs text-ink-muted">
          Complete your profile with faculty, department &amp; programme to see class schedules and
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

  if (authMode === "api" && membership?.status === "pending") {
    return (
      <div className="mx-auto max-w-md rounded-xl border border-border-light bg-card-light p-6 text-center">
        <Clock className="mx-auto mb-3 text-amber-500" size={32} />
        <p className="text-sm font-semibold text-ink">Waiting for admission</p>
        <p className="mt-1 text-xs text-ink-muted">A Course Rep will review your request.</p>
        {membershipMessage && <p className="mt-2 text-xs text-teal">{membershipMessage}</p>}
      </div>
    );
  }

  if (authMode === "api" && membership?.status === "rejected") {
    return (
      <div className="mx-auto max-w-md rounded-xl border border-border-light bg-card-light p-6 text-center">
        <XCircle className="mx-auto mb-3 text-rose-400" size={32} />
        <p className="text-sm font-semibold text-ink">Membership request rejected</p>
        {membership.reviewReason && <p className="mt-2 text-xs text-rose-600">Reason: {membership.reviewReason}</p>}
        <button type="button" onClick={requestMembership} disabled={membershipBusy} className="mt-4 rounded-full bg-teal px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">Request again</button>
        {membershipMessage && <p className="mt-2 text-xs text-teal">{membershipMessage}</p>}
      </div>
    );
  }

  if (authMode === "api" && membershipLoading) {
    return (
      <div className="mx-auto max-w-md rounded-xl border border-border-light bg-card-light p-6 text-center">
        <Loader2 className="mx-auto mb-3 animate-spin text-teal" size={28} />
        <p className="text-sm text-ink-muted">Loading your programme membership…</p>
      </div>
    );
  }

  if (authMode === "api" && !membership && !isRepHere) {
    return (
      <div className="mx-auto max-w-md rounded-xl border border-border-light bg-card-light p-6 text-center">
        <Users className="mx-auto mb-3 text-ink-muted" size={32} />
        <p className="text-sm text-ink-muted">You are not yet a member of this programme group.</p>
        <button type="button" onClick={requestMembership} disabled={membershipBusy} className="mt-4 rounded-full bg-teal px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{membershipBusy ? "Sending…" : "Request to join"}</button>
        {membershipMessage && <p className="mt-2 text-xs text-teal">{membershipMessage}</p>}
      </div>
    );
  }

  if (hasCourseRep === false && !isRepHere && membership?.status !== "active") {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-border-light bg-card-light p-8 text-center shadow-sm">
        <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-bg-panel-alt text-ink-muted">
          <Lock size={28} />
        </span>
        <p className="font-display text-base font-semibold text-ink">No Course Rep yet</p>
        <p className="mt-2 text-sm text-ink-muted leading-relaxed">
          There is no Course Rep assigned for{" "}
          <strong className="text-ink">{hubTitle}</strong>
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
          for your programme and level.
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

  const now = Date.now();
  const upcoming = classes
    .filter((c) => toMillis(c.startsAt) > now)
    .sort((x, y) => toMillis(x.startsAt) - toMillis(y.startsAt));

  function flash(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 4000);
  }

  async function deletePost(post) {
    if (authMode !== "api" || !post?.id) return;
    if (!window.confirm(`Delete “${post.title || "this post"}”? This cannot be undone.`)) return;
    try {
      await feedApi.remove("course", post.id);
      setPosts((current) => current.filter((item) => item.id !== post.id));
      flash("Post deleted");
    } catch (error) {
      flash(error.message || "Could not delete post");
    }
  }

  // One feed: rep updates, upcoming classes and materials. Pinned updates stay
  // on top; everything else is newest first.
  const feedItems = [
    ...posts.map((p) => ({ kind: "update", id: p.id, at: toMillis(p.createdAt), pinned: Boolean(p.pinned), item: p })),
    ...upcoming.map((c) => ({ kind: "class", id: c.id, at: toMillis(c.createdAt) || toMillis(c.startsAt), pinned: false, item: c })),
    ...materials.map((m) => ({ kind: "material", id: m.id, at: toMillis(m.createdAt), pinned: false, item: m })),
  ].sort((x, y) => (Number(y.pinned) - Number(x.pinned)) || y.at - x.at);
  const visibleItems = feedFilter === "all"
    ? feedItems
    : feedItems.filter((f) => ({ updates: "update", classes: "class", materials: "material" }[feedFilter] === f.kind));
  const nextClass = upcoming[0];
  const audience = [program, level].filter(Boolean).join(" · ");

  function renderItem(f) {
    if (f.kind === "update") {
      const post = f.item;
      const comments = Array.isArray(post.comments) ? post.comments : [];
      const ownPost = post.authorId === user?.uid || post.authorId === user?.id;
      const sameProgrammeRepPost = (post.authorRole || "courseRep") === "courseRep"
        && deptsMatch(post.department, program);
      const canDelete = authMode === "api" && profile?.role === "courseRep" && (ownPost || sameProgrammeRepPost);
      return (
        <FeedCard
          key={`u-${post.id}`}
          onDelete={canDelete ? () => deletePost(post) : undefined}
          type="announcement"
          author={feedAuthorName(post)}
          authorPhoto={post.authorPhoto}
          authorRole={post.authorRole || "courseRep"}
          time={relTime(post.createdAt)}
          pinned={post.pinned}
          courseCode={post.courseCode}
          title={post.title}
          footer={
            <div className="w-full">
              <div className="flex flex-wrap items-center gap-1.5">
                <ReactionBar uid={user?.uid} reactions={post.reactions} onReact={(type) => togglePostReaction("coursePosts", post.id, type)} />
              </div>
              <div className="mt-1.5">
                <CommentThread
                  comments={comments}
                  uid={user?.uid}
                  open={Boolean(expandedComments[post.id])}
                  onToggle={() => setExpandedComments((p) => ({ ...p, [post.id]: !p[post.id] }))}
                  value={commentText[post.id] || ""}
                  onChange={(v) => setCommentText((p) => ({ ...p, [post.id]: v }))}
                  onSubmit={() => addComment(post.id)}
                  busy={commentBusy[post.id]}
                  onReactComment={(commentId, type) => toggleCommentReaction("coursePosts", post.id, commentId, type)}
                />
              </div>
            </div>
          }
        >
          <PostBody text={post.body} />
        </FeedCard>
      );
    }
    if (f.kind === "class") {
      const ev = f.item;
      const comments = Array.isArray(ev.comments) ? ev.comments : [];
      return (
        <FeedCard
          key={`c-${ev.id}`}
          type="class"
          author={safeName(ev.createdByName)}
          authorRole="courseRep"
          time={relTime(ev.createdAt)}
          courseCode={ev.courseCode}
          title={ev.title}
          footer={
            <div className="w-full">
              <ReactionBar uid={user?.uid} reactions={ev.reactions} onReact={(type) => togglePostReaction("classEvents", ev.id, type)} />
              <div className="mt-1.5">
                <CommentThread
                  comments={comments}
                  uid={user?.uid}
                  open={Boolean(expandedClassComments[ev.id])}
                  onToggle={() => setExpandedClassComments((p) => ({ ...p, [ev.id]: !p[ev.id] }))}
                  value={classCommentText[ev.id] || ""}
                  onChange={(v) => setClassCommentText((p) => ({ ...p, [ev.id]: v }))}
                  onSubmit={() => addClassComment(ev.id)}
                  busy={classCommentBusy[ev.id]}
                  onReactComment={(commentId, type) => toggleCommentReaction("classEvents", ev.id, commentId, type)}
                />
              </div>
            </div>
          }
        >
          <ClassDateBlock start={ev.startsAt} end={ev.endsAt} venue={ev.venue} notes={ev.notes} />
        </FeedCard>
      );
    }
    const mat = f.item;
    return (
      <FeedCard
        key={`m-${mat.id}`}
        type="material"
        author={safeName(mat.uploadedBy?.name || mat.uploadedByName)}
        authorRole="courseRep"
        time={relTime(mat.createdAt)}
        courseCode={mat.course?.code || mat.courseCode}
        title={mat.title}
        footer={<ReactionBar uid={user?.uid} reactions={mat.reactions} onReact={(type) => togglePostReaction("documents", mat.id, type)} />}
      >
        {(mat.course?.title || mat.courseTitle) && (
          <p className="mt-0.5 text-sm text-ink-muted">{mat.course?.title || mat.courseTitle}</p>
        )}
        <PostBody text={mat.description} />
        <FileRow
          name={mat.fileName || mat.title}
          url={mat.fileUrl || mat.url}
          size={mat.fileSize}
          saved={savedIds.has(mat.id)}
          saving={saveBusy[mat.id]}
          onSave={() => saveMaterial(mat)}
        />
      </FeedCard>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 animate-stitch-in">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow text-ink-muted">Programme</p>
          <h1 className="mt-1 break-words font-display text-[1.6rem] leading-tight tracking-[-0.02em] text-ink sm:text-[1.9rem]">
            {hubTitle}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {hubSubtitleParts.length ? hubSubtitleParts.join(" · ") : "Your programme and level"}
          </p>
        </div>
        {isRepHere && (
          <button
            type="button"
            onClick={() => navigate("/dashboard/course-rep")}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border-light px-3 text-xs font-medium text-ink-muted transition hover:border-border-strong hover:text-ink"
          >
            <Settings2 size={14} /> Rep panel
          </button>
        )}
      </header>

      {toast && (
        <p role="status" className="rounded-xl border border-teal/20 bg-teal-soft px-4 py-2.5 text-sm font-medium text-teal">
          {toast}
        </p>
      )}

      {isRepHere && (
        <RepComposer
          profile={profile}
          audience={level || "your class"}
          onPost={() => setShowAnnounce(true)}
          onSchedule={() => setShowSchedule(true)}
          onUpload={() => navigate("/dashboard/course-rep#upload")}
        />
      )}

      {nextClass && feedFilter === "all" && (
        <button
          type="button"
          onClick={() => setFeedFilter("classes")}
          className="flex w-full items-center gap-3 rounded-2xl border border-border-light bg-card-light px-4 py-3 text-left transition hover:border-border-strong"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-aqua-soft text-aqua-deep dark:bg-aqua/15 dark:text-aqua">
            <Calendar size={16} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs text-ink-muted">Next class</span>
            <span className="block truncate text-sm font-medium text-ink">
              {nextClass.courseCode ? `${nextClass.courseCode} · ` : ""}{nextClass.title}
            </span>
          </span>
          <span className="shrink-0 text-right text-xs text-ink-muted">
            {new Date(toMillis(nextClass.startsAt)).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })}
            <span className="block font-medium text-ink">
              {new Date(toMillis(nextClass.startsAt)).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            </span>
          </span>
        </button>
      )}

      <FilterTabs
        value={feedFilter}
        onChange={setFeedFilter}
        options={[
          ["all", "All", 0],
          ["updates", "Updates", posts.length],
          ["classes", "Classes", upcoming.length],
          ["materials", "Materials", materials.length],
        ]}
      />

      <section className="space-y-3" aria-label={`Posts for ${audience}`}>
        {visibleItems.length === 0 ? (
          <EmptyFeed filter={feedFilter} isRep={isRepHere} />
        ) : (
          visibleItems.map(renderItem)
        )}
      </section>

      {/* Quick composers (Course Rep only) */}
      <ScheduleClassModal
        open={showSchedule}
        onClose={(created) => {
          setShowSchedule(false);
          if (created) {
            flash("Class scheduled. Your class can see it now.");
            classEventsApi.list()
              .then(({ events = [] }) => setClasses(events.filter((event) => matchesAcademicScope(event.program || event.department, profile) && matchesStudentLevel(event.level, level))))
              .catch(() => {});
          }
        }}
        department={departmentName || program}
        program={program}
        level={level}
        faculty={faculty}
        user={user}
        authorName={profile?.name || profile?.nickname || "Course Rep"}
        authMode={authMode}
      />
      <CreateAnnouncementModal
        open={showAnnounce}
        onClose={(created) => {
          setShowAnnounce(false);
          if (created) {
            flash("Announcement posted.");
            feedApi.list("course", `program=${encodeURIComponent(program)}`)
              .then(({ posts = [] }) => {
                setPosts(posts.filter((item) => matchesStudentLevel(item.level, level)));
              })
              .catch((error) => {
                console.error("Announcement posted, but the feed refresh failed:", error);
                flash("Announcement posted. Reload to refresh the feed.");
              });
          }
        }}
        department={departmentName || program}
        program={program}
        level={level}
        faculty={faculty}
        user={user}
        authorName={profile?.name || profile?.nickname || "Course Rep"}
        authMode={authMode}
      />
    </div>
  );
}
