import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  updateDoc,
} from "firebase/firestore";
import {
  MessageCircle,
  Send,
  Loader2,
  Filter,
  ChevronDown,
} from "lucide-react";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import UserAvatar, { displayLabel, NameWithBadge } from "./UserAvatar";

/**
 * Staff-wide department feed viewer.
 * - Sorted by newest first (pins ignored for staff)
 * - Filter by faculty / department
 * - Admin + Alpha can comment; regular agents view only
 * - compact=true shows a short preview for dashboards
 */
export default function StaffFeed({ compact = false, maxItems = 40 }) {
  const { user, profile, authMode } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [faculty, setFaculty] = useState("");
  const [department, setDepartment] = useState("");
  const [expanded, setExpanded] = useState({});
  const [commentText, setCommentText] = useState({});
  const [busy, setBusy] = useState({});

  const canComment =
    profile?.role === "admin" || profile?.role === "alphaAgent";
  const roleLabel =
    profile?.role === "alphaAgent"
      ? "Alpha Agent"
      : profile?.role === "admin"
        ? "Admin"
        : profile?.role === "agent"
          ? "Agent"
          : "Staff";

  useEffect(() => {
    if (authMode === "api") {
      setPosts([]);
      setLoading(false);
      return;
    }
    const unsub = onSnapshot(
      collection(db, "coursePosts"),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        // Staff view: pure recency (ignore pin)
        list.sort((a, b) => {
          const ta =
            a.createdAt?.toMillis?.() ||
            a.createdAt?.seconds * 1000 ||
            0;
          const tb =
            b.createdAt?.toMillis?.() ||
            b.createdAt?.seconds * 1000 ||
            0;
          return tb - ta;
        });
        setPosts(list);
        setLoading(false);
      },
      () => {
        setPosts([]);
        setLoading(false);
      }
    );
    return unsub;
  }, [authMode]);

  const faculties = useMemo(() => {
    const s = new Set();
    posts.forEach((p) => {
      if (p.faculty) s.add(p.faculty);
    });
    return [...s].sort();
  }, [posts]);

  const departments = useMemo(() => {
    const s = new Set();
    posts.forEach((p) => {
      if (faculty && p.faculty !== faculty) return;
      if (p.department) s.add(p.department);
    });
    return [...s].sort();
  }, [posts, faculty]);

  const filtered = useMemo(() => {
    return posts.filter((p) => {
      if (faculty && p.faculty !== faculty) return false;
      if (department && p.department !== department) return false;
      return true;
    });
  }, [posts, faculty, department]);

  const visible = compact ? filtered.slice(0, 5) : filtered.slice(0, maxItems);

  async function addComment(postId) {
    if (!canComment || !user) return;
    const text = (commentText[postId] || "").trim();
    if (!text) return;
    setBusy((p) => ({ ...p, [postId]: true }));
    try {
      const post = posts.find((x) => x.id === postId);
      const comments = Array.isArray(post?.comments) ? [...post.comments] : [];
      comments.push({
        id: `${Date.now()}_${user.uid}`,
        text,
        authorUid: user.uid,
        authorName: displayLabel(profile, profile?.name || "Staff"),
        authorPhoto: profile?.photoURL || profile?.avatarUrl || null,
        authorRole: profile?.role || "admin",
        authorPlan: profile?.plan || null,
        authorSubscription: profile?.subscription || null,
        createdAt: new Date().toISOString(),
        reactions: [],
      });
      await updateDoc(doc(db, "coursePosts", postId), { comments });
      setCommentText((p) => ({ ...p, [postId]: "" }));
      setExpanded((p) => ({ ...p, [postId]: true }));
    } catch (e) {
      alert(e.message || "Could not comment.");
    } finally {
      setBusy((p) => ({ ...p, [postId]: false }));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <Filter size={14} className="text-accent" />
            Department feeds
          </h2>
          <p className="text-xs text-text-muted mt-0.5">
            Newest first across all departments
            {!canComment && " · View only (Agents can’t comment)"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={faculty}
            onChange={(e) => {
              setFaculty(e.target.value);
              setDepartment("");
            }}
            className="rounded-lg border border-border-subtle bg-bg-panel px-2.5 py-1.5 text-xs text-text-primary"
          >
            <option value="">All faculties</option>
            {faculties.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="rounded-lg border border-border-subtle bg-bg-panel px-2.5 py-1.5 text-xs text-text-primary"
          >
            <option value="">All departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading && (
        <p className="flex items-center gap-2 text-sm text-text-muted">
          <Loader2 size={14} className="animate-spin" /> Loading feeds…
        </p>
      )}

      {!loading && visible.length === 0 && (
        <div className="rounded-xl border border-border-subtle bg-bg-panel px-4 py-8 text-center text-sm text-text-muted">
          No department posts match this filter.
        </div>
      )}

      <div className="flex flex-col gap-3">
        {visible.map((post) => {
          const comments = Array.isArray(post.comments) ? post.comments : [];
          const open = expanded[post.id];
          return (
            <article
              key={post.id}
              className="rounded-xl border border-border-subtle bg-bg-panel p-4"
            >
              <div className="flex items-start gap-3">
                <UserAvatar
                  name={post.authorName || "Course Rep"}
                  photoURL={post.authorPhoto}
                  role={post.authorRole || "courseRep"}
                  size={36}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm text-text-primary">
                      <NameWithBadge
                        name={post.authorName || "Course Rep"}
                        role={post.authorRole || "courseRep"}
                        plan={post.authorPlan}
                        subscription={post.authorSubscription}
                      />
                    </p>
                    {post.department && (
                      <span className="rounded-full bg-bg-panel-alt px-2 py-0.5 text-[10px] font-bold text-text-secondary">
                        {post.department}
                      </span>
                    )}
                    {post.faculty && (
                      <span className="text-[10px] text-text-muted">
                        {post.faculty}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-text-muted">
                    {post.createdAt?.toDate
                      ? post.createdAt.toDate().toLocaleString()
                      : ""}
                    {post.level ? ` · ${post.level}` : ""}
                  </p>
                </div>
              </div>
              <h3 className="mt-2 text-sm font-semibold text-text-primary">
                {post.title}
              </h3>
              <p className="mt-1 text-sm text-text-secondary whitespace-pre-wrap">
                {compact && post.body?.length > 220
                  ? post.body.slice(0, 220) + "…"
                  : post.body}
              </p>

              <div className="mt-3 border-t border-border-subtle pt-2">
                <button
                  type="button"
                  onClick={() =>
                    setExpanded((p) => ({ ...p, [post.id]: !p[post.id] }))
                  }
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-accent"
                >
                  <MessageCircle size={13} />
                  {comments.length} comment{comments.length !== 1 ? "s" : ""}
                  <ChevronDown
                    size={12}
                    className={`transition ${open ? "rotate-180" : ""}`}
                  />
                </button>

                {open && (
                  <div className="mt-2 space-y-2">
                    {comments.length === 0 && (
                      <p className="text-xs text-text-muted">No comments yet.</p>
                    )}
                    {comments.map((c) => {
                      const anon = !!c.isAnonymous;
                      const displayName = anon
                        ? (c.authorRealName || c.authorRealNickname || "Student")
                        : (c.authorName || "User");
                      return (
                      <div
                        key={c.id}
                        className="flex gap-2 rounded-lg bg-bg-panel-alt/60 px-3 py-2"
                      >
                        <UserAvatar
                          name={displayName}
                          photoURL={anon ? null : c.authorPhoto}
                          role={c.authorRole}
                          size={26}
                        />
                        <div>
                          <p className="text-xs text-text-primary">
                            <NameWithBadge
                              name={displayName}
                              role={c.authorRole}
                              plan={c.authorPlan}
                              subscription={c.authorSubscription}
                            />
                            {anon && (
                              <span className="ml-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                                posted as Anonymous
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-text-secondary whitespace-pre-wrap">
                            {c.text}
                          </p>
                        </div>
                      </div>
                      );
                    })}

                    {canComment ? (
                      <div className="flex gap-2 pt-1">
                        <input
                          className="w-full rounded-lg border border-border-subtle bg-bg-app px-3 py-2 text-xs text-text-primary"
                          placeholder={`Comment as ${roleLabel}…`}
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
                          disabled={busy[post.id]}
                          onClick={() => addComment(post.id)}
                          className="inline-flex shrink-0 items-center rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-bg-app disabled:opacity-60"
                        >
                          {busy[post.id] ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Send size={14} />
                          )}
                        </button>
                      </div>
                    ) : (
                      <p className="text-[11px] text-text-muted pt-1">
                        Viewing only — Alpha Agents and Admins can comment.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
