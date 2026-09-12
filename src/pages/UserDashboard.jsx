import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  doc,
  onSnapshot,
  query,
  updateDoc,
  limit,
} from "firebase/firestore";
import {
  BookMarked,
  Brain,
  Flame,
  Sparkles,
  ClipboardCheck,
  Library,
  BookOpen,
  ArrowRight,
  Play,
  Eye,
  MessageCircle,
  Send,
  Loader2,
  Megaphone,
  ChevronDown,
} from "lucide-react";
import { db } from "../firebase/config";
import StudentKpiCard from "../components/StudentKpiCard";
import UserAvatar, { displayLabel, NameWithBadge, isProUser } from "../components/UserAvatar";
import { useUserDashboardData } from "../hooks/useUserDashboardData";
import { useCbtData } from "../hooks/useCbtData";
import { useAuth } from "../context/AuthContext";
import { recordDailyActivity } from "../lib/activity";
import { feedApi } from "../lib/api";


const REACTIONS = [
  { type: "like", emoji: "👍", label: "Acknowledge" },
  { type: "haha", emoji: "😂", label: "Haha" },
  { type: "love", emoji: "❤️", label: "Love" },
];

function countReactions(list) {
  const counts = { like: 0, haha: 0, love: 0 };
  (list || []).forEach((r) => {
    if (counts[r.type] !== undefined) counts[r.type] += 1;
  });
  return counts;
}

const field =
  "w-full rounded-xl border border-border-light bg-card-light px-3 py-2 text-sm text-ink focus:border-teal focus:outline-none";

export default function UserDashboard() {
  const navigate = useNavigate();
  const { user, profile, authMode } = useAuth();
  const { kpis, loading } = useUserDashboardData();
  const { practiceSets, loading: cbtLoading } = useCbtData({ withQuestions: true });

  const [feedTab, setFeedTab] = useState("department"); // department | general
  const [deptPosts, setDeptPosts] = useState([]);
  const [generalPosts, setGeneralPosts] = useState([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [commentText, setCommentText] = useState({});
  const [commentBusy, setCommentBusy] = useState({});
  const [expanded, setExpanded] = useState({});
  const [anonComment, setAnonComment] = useState({});

  const department = profile?.department || "";
  const level = profile?.level || "";
  const firstName =
    profile?.nickname ||
    profile?.nickName ||
    profile?.name?.split(" ")[0] ||
    "there";

  useEffect(() => {
    if (authMode === "api") {
      if (!department) { setDeptPosts([]); setFeedLoading(false); return; }
      setFeedLoading(true);
      feedApi
        .list("course", `department=${encodeURIComponent(department)}`)
        .then(({ posts = [] }) =>
          setDeptPosts(
            posts
              .filter((p) => !level || !p.level || String(p.level).trim() === String(level).trim())
              .slice(0, 8)
          )
        )
        .catch(() => setDeptPosts([]))
        .finally(() => setFeedLoading(false));
      return;
    }
    if (user && profile) recordDailyActivity(user, profile);
  }, [user?.uid, profile?.lastActiveDate, department, level, authMode]);

  // General feed (admin posts)
  useEffect(() => {
    if (authMode === "api") {
      feedApi.list("general").then(({ posts = [] }) => setGeneralPosts(posts.slice(0, 12))).catch(() => setGeneralPosts([]));
      return;
    }
    const q = query(collection(db, "generalPosts"), limit(12));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => {
          if (a.pinned && !b.pinned) return -1;
          if (!a.pinned && b.pinned) return 1;
          const ta = a.createdAt?.toMillis?.() || a.createdAt?.seconds * 1000 || 0;
          const tb = b.createdAt?.toMillis?.() || b.createdAt?.seconds * 1000 || 0;
          return tb - ta;
        });
        setGeneralPosts(list);
      },
      () => setGeneralPosts([])
    );
    return unsub;
  }, [authMode]);

  const activePosts = feedTab === "department" ? deptPosts : generalPosts;
  const previewPosts = activePosts.slice(0, 3);

  
  async function toggleFeedReaction(collectionName, postId, reactionType) {
    if (!user) return;
    try {
      const list = collectionName === "generalPosts" ? generalPosts : deptPosts;
      const post = list.find((p) => p.id === postId);
      if (!post) return;
      let reactions = Array.isArray(post.reactions) ? [...post.reactions] : [];
      const existing = reactions.findIndex((r) => r.uid === user.uid);
      if (existing >= 0) {
        if (reactions[existing].type === reactionType) reactions.splice(existing, 1);
        else
          reactions[existing] = {
            uid: user.uid,
            type: reactionType,
            name: displayLabel(profile, "Student"),
          };
      } else {
        reactions.push({
          uid: user.uid,
          type: reactionType,
          name: displayLabel(profile, "Student"),
        });
      }
      if (authMode === "api") await feedApi.update(collectionName === "generalPosts" ? "general" : "course", postId, { reactions });
      else await updateDoc(doc(db, collectionName, postId), { reactions });
    } catch (e) {
      alert(e.message || "Could not react.");
    }
  }

  async function addComment(collectionName, postId) {
    const text = (commentText[postId] || "").trim();
    if (!text || !user) return;
    setCommentBusy((p) => ({ ...p, [postId]: true }));
    try {
      const list = collectionName === "generalPosts" ? generalPosts : deptPosts;
      const post = list.find((p) => p.id === postId);
      const comments = Array.isArray(post?.comments) ? [...post.comments] : [];
      const isPro =
        profile?.plan === "annual" ||
        profile?.plan === "paid" ||
        profile?.plan === "pro" ||
        profile?.subscription === "pro";
      const asAnonymous =
        isPro && profile?.allowAnonymousComments === true && !!anonComment[postId];
      comments.push({
        id: `${Date.now()}_${user.uid}`,
        text,
        authorUid: user.uid, // always stored for admin/agent accountability
        // Public fields (what students see)
        authorName: asAnonymous
          ? "Anonymous"
          : displayLabel(profile, user.email || "Student"),
        authorPhoto: asAnonymous
          ? null
          : profile?.photoUrl || profile?.avatarUrl || profile?.photoURL || null,
        authorRole: asAnonymous ? "user" : profile?.role || "user",
        authorPlan: asAnonymous ? null : profile?.plan || null,
        authorSubscription: asAnonymous ? null : profile?.subscription || null,
        authorDepartment: asAnonymous
          ? null
          : profile?.showDepartment !== false
            ? profile?.department || null
            : null,
        authorPhone: asAnonymous
          ? null
          : profile?.showPhone === true
            ? profile?.phone || null
            : null,
        isAnonymous: asAnonymous,
        // Staff-only identity (never shown on student UI)
        authorRealName: asAnonymous
          ? (profile?.name || profile?.nickname || user.email || "Student")
          : null,
        authorRealNickname: asAnonymous
          ? (profile?.nickname || profile?.nickName || null)
          : null,
        createdAt: new Date().toISOString(),
        reactions: [],
      });
      if (authMode === "api") await feedApi.update(collectionName === "generalPosts" ? "general" : "course", postId, { comments });
      else await updateDoc(doc(db, collectionName, postId), { comments });
      setCommentText((p) => ({ ...p, [postId]: "" }));
      setAnonComment((p) => ({ ...p, [postId]: false }));
      setExpanded((p) => ({ ...p, [postId]: true }));
    } catch (e) {
      alert(e.message || "Could not comment.");
    } finally {
      setCommentBusy((p) => ({ ...p, [postId]: false }));
    }
  }

  const relevantPractice = useMemo(() => {
    if (!practiceSets.length) return [];
    let list = practiceSets;
    if (profile?.faculty) {
      const m = list.filter((s) => s.faculty === profile.faculty);
      if (m.length) list = m;
    }
    if (profile?.level) {
      const m = list.filter((s) => s.level === profile.level);
      if (m.length) list = m;
    }
    return list.slice(0, 4);
  }, [practiceSets, profile?.faculty, profile?.level]);

  return (
    <div className="space-y-8 animate-stitch-in">
      {/* Welcome */}
      <section className="rounded-2xl border border-border-light bg-card-light p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <UserAvatar profile={profile} size={48} />
            <div>
              <h1 className="text-lg font-semibold text-ink sm:text-xl">
                Welcome back, {firstName}
              </h1>
              <p className="mt-0.5 text-sm text-ink-muted">
                {profile?.name && (profile?.nickname || profile?.nickName)
                  ? profile.name
                  : null}
                {profile?.faculty
                  ? `${profile?.name && (profile?.nickname || profile?.nickName) ? " · " : ""}${profile.faculty}${profile.level ? ` · ${profile.level}` : ""}`
                  : "Complete your profile for personalised feeds."}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => navigate("/dashboard/practice")}
              className="flex items-center gap-2 rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-dark"
            >
              <ClipboardCheck size={15} />
              Practice CBT
            </button>
            <button
              type="button"
              onClick={() => navigate("/dashboard/reading-hub")}
              className="flex items-center gap-2 rounded-lg border border-border-light bg-surface-light px-4 py-2 text-sm font-medium text-ink hover:border-teal/40"
            >
              <Library size={15} />
              Reading Hub
            </button>
          </div>
        </div>
      </section>

      {/* KPIs */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-ink-muted">Your progress</h2>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <StudentKpiCard
            icon={Flame}
            value={loading ? "--" : `${kpis.studyStreakDays}`}
            label="Day streak"
            subtitle={kpis.studyStreakDays > 0 ? "Keep it going!" : "Open the app daily"}
            accent="flame"
          />
          <StudentKpiCard
            icon={Eye}
            value={loading ? "--" : kpis.materialsOpened}
            label="Materials opened"
            subtitle="Every open counts"
            accent="violet"
          />
          <StudentKpiCard
            icon={Brain}
            value={loading ? "--" : kpis.questionsPracticed}
            label="Questions practiced"
            accent="orange"
          />
          <StudentKpiCard
            icon={BookMarked}
            value={loading ? "--" : kpis.coursesEnrolled}
            label="Courses enrolled"
            accent="blue"
          />
        </div>
      </section>

      {/* Feed — Department (default) / General */}
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
          <h2 className="font-display text-base font-semibold text-ink flex items-center gap-2">
            <Megaphone size={16} className="text-teal" />
            Feed
          </h2>
          <div className="flex rounded-full border border-border-light bg-card-light p-0.5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setFeedTab("department")}
              className={`rounded-full px-3 py-1.5 transition ${
                feedTab === "department"
                  ? "bg-teal text-white"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              Department
            </button>
            <button
              type="button"
              onClick={() => setFeedTab("general")}
              className={`rounded-full px-3 py-1.5 transition ${
                feedTab === "general"
                  ? "bg-teal text-white"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              General
            </button>
          </div>
        </div>

        {feedLoading && feedTab === "department" && (
          <p className="flex items-center gap-2 text-sm text-ink-muted px-1">
            <Loader2 size={14} className="animate-spin" /> Loading feed…
          </p>
        )}

        {!feedLoading && previewPosts.length === 0 && (
          <div className="card-stitch rounded-2xl px-4 py-8 text-center text-sm text-ink-muted">
            {feedTab === "department"
              ? department
                ? "No department posts yet. Your Course Rep’s announcements will appear here."
                : "Set your department in Profile to see the department feed."
              : "No general posts yet. School-wide updates from Admin will appear here."}
          </div>
        )}

        <div className="flex flex-col gap-4">
          {previewPosts.map((post) => {
            const comments = Array.isArray(post.comments) ? post.comments : [];
            const open = expanded[post.id];
            const coll =
              feedTab === "general" ? "generalPosts" : "coursePosts";
            const accent = post.pinned
              ? "bg-pink-500"
              : feedTab === "general"
                ? "bg-violet-500"
                : "bg-teal";
            return (
              <article
                key={post.id}
                className="card-stitch relative overflow-hidden rounded-3xl p-5 pl-6"
              >
                <div
                  className={`absolute left-0 top-0 h-full w-1.5 rounded-l-3xl ${accent}`}
                />
                <div className="flex items-start gap-3">
                  <UserAvatar
                    name={post.authorName || post.createdByName || "Author"}
                    photoURL={post.authorPhoto}
                    role={post.authorRole}
                    size={40}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm text-ink">
                        <NameWithBadge
                          name={post.authorName || post.createdByName || "Author"}
                          role={post.authorRole || (feedTab === "general" ? "admin" : "courseRep")}
                          plan={post.authorPlan}
                          subscription={post.authorSubscription}
                        />
                      </p>
                      {post.pinned && (
                        <span className="rounded-full bg-pink-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-pink-600">
                          Pinned
                        </span>
                      )}
                      {feedTab === "general" && (
                        <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-violet-600">
                          General
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-ink-muted">
                      {post.createdAt?.toDate
                        ? post.createdAt.toDate().toLocaleString()
                        : ""}
                    </p>
                  </div>
                </div>
                <h3 className="mt-3 text-base font-semibold text-ink">
                  {post.title}
                </h3>
                <p className="mt-1 text-sm text-ink-muted whitespace-pre-wrap leading-relaxed">
                  {post.body}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {REACTIONS.map(({ type, emoji, label }) => {
                    const counts = countReactions(post.reactions);
                    const mine = (post.reactions || []).find((r) => r.uid === user?.uid);
                    const active = mine?.type === type;
                    return (
                      <button
                        key={type}
                        type="button"
                        title={label}
                        onClick={() => toggleFeedReaction(coll, post.id, type)}
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-sm transition ${
                          active
                            ? "border-teal/40 bg-teal-soft text-teal font-semibold"
                            : "border-border-light bg-card-light text-ink-muted hover:border-teal/30"
                        }`}
                      >
                        <span>{emoji}</span>
                        {(counts[type] || 0) > 0 && (
                          <span className="text-[11px] tabular-nums">{counts[type]}</span>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-3 border-t border-border-light pt-3">
                  <button
                    type="button"
                    onClick={() =>
                      setExpanded((p) => ({ ...p, [post.id]: !p[post.id] }))
                    }
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-teal hover:underline"
                  >
                    <MessageCircle size={13} />
                    {comments.length} comment
                    {comments.length !== 1 ? "s" : ""}
                    <ChevronDown
                      size={12}
                      className={`transition ${open ? "rotate-180" : ""}`}
                    />
                  </button>

                  {open && (
                    <div className="mt-3 space-y-2">
                      {comments.length === 0 && (
                        <p className="text-xs text-ink-muted">
                          No comments yet. Be first!
                        </p>
                      )}
                      {comments.slice(-5).map((c) => {
                        const anon = !!c.isAnonymous;
                        return (
                          <div
                            key={c.id || `${c.authorUid || "x"}-${c.createdAt || ""}`}
                            className="flex gap-2 rounded-xl bg-bg-panel-alt/50 px-3 py-2"
                          >
                            {anon ? (
                              <div
                                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink-muted/15 text-[10px] font-bold text-ink-muted"
                                title="Anonymous"
                              >
                                ?
                              </div>
                            ) : (
                              <UserAvatar
                                name={c.authorName}
                                nickname={c.authorNickname}
                                photoURL={c.authorPhoto}
                                department={c.authorDepartment}
                                phone={c.authorPhone}
                                role={c.authorRole}
                                plan={c.authorPlan}
                                subscription={c.authorSubscription}
                                size={28}
                              />
                            )}
                            <div className="min-w-0">
                              <p className="text-xs text-ink">
                                {anon ? (
                                  <span className="font-semibold">Anonymous</span>
                                ) : (
                                  <NameWithBadge
                                    name={c.authorName || "Student"}
                                    nickname={c.authorNickname}
                                    role={c.authorRole}
                                    plan={c.authorPlan}
                                    subscription={c.authorSubscription}
                                  />
                                )}
                              </p>
                              <p className="text-xs text-ink-muted whitespace-pre-wrap">
                                {c.text}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                      <div className="space-y-2 pt-1">
                        {(profile?.plan === "annual" || profile?.plan === "paid" || profile?.plan === "pro" || profile?.subscription === "pro") && profile?.allowAnonymousComments && (
                          <label className="flex items-center gap-2 text-[11px] text-ink-muted">
                            <input
                              type="checkbox"
                              checked={!!anonComment[post.id]}
                              onChange={(e) =>
                                setAnonComment((p) => ({
                                  ...p,
                                  [post.id]: e.target.checked,
                                }))
                              }
                            />
                            Comment as Anonymous
                          </label>
                        )}
                      <div className="flex gap-2">
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
                              addComment(coll, post.id);
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => addComment(coll, post.id)}
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
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        {feedTab === "department" && department && (
          <button
            type="button"
            onClick={() => navigate("/dashboard/department")}
            className="mt-3 text-sm font-semibold text-teal hover:underline inline-flex items-center gap-1"
          >
            Open full Department Hub <ArrowRight size={14} />
          </button>
        )}
      </section>

      {/* Compact practice strip */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink-muted">Practice sets</h2>
          <button
            type="button"
            onClick={() => navigate("/dashboard/practice")}
            className="text-xs font-medium text-teal hover:underline"
          >
            See all →
          </button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {cbtLoading && (
            <p className="col-span-4 text-sm text-ink-muted">Loading…</p>
          )}
          {!cbtLoading && relevantPractice.length === 0 && (
            <p className="col-span-4 rounded-2xl border border-dashed border-border-light bg-card-light p-4 text-center text-sm text-ink-muted">
              Practice sets for your faculty will appear here.
            </p>
          )}
          {relevantPractice.map((set) => (
            <button
              key={set.courseCode}
              type="button"
              onClick={() => navigate("/dashboard/practice")}
              className="card-stitch flex flex-col rounded-2xl p-4 text-left transition hover:border-teal/40"
            >
              <span className="inline-block w-fit rounded-md bg-teal-soft px-2 py-0.5 text-[11px] font-bold tracking-wide text-teal">
                {set.courseCode}
              </span>
              <p className="mt-2 truncate text-sm font-semibold text-ink">
                {set.courseTitle}
              </p>
              <p className="mt-1 text-xs text-ink-muted">
                {set.questionCount} question
                {set.questionCount !== 1 ? "s" : ""}
              </p>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
