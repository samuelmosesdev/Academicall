import { useEffect, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { Megaphone, Plus, Trash2, Pin, MessageCircle, Globe } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { announcementsApi, feedApi } from "../lib/api";

const fieldClass =
  "w-full rounded-lg border border-border-subtle bg-bg-panel px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none";

export default function AdminAnnouncements() {
  const { profile, user, authMode } = useAuth();
  const [tab, setTab] = useState("announcements");

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState("all");
  const [pinned, setPinned] = useState(false);
  const [published, setPublished] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [general, setGeneral] = useState([]);
  const [gLoading, setGLoading] = useState(true);
  const [gShow, setGShow] = useState(false);
  const [gTitle, setGTitle] = useState("");
  const [gBody, setGBody] = useState("");
  const [gPinned, setGPinned] = useState(false);
  const [gBusy, setGBusy] = useState(false);
  const [gError, setGError] = useState("");
  const [openComments, setOpenComments] = useState({});

  useEffect(() => {
    if (authMode === "api") {
      let alive = true;
      announcementsApi.list().then(({ announcements = [] }) => alive && setItems(announcements)).catch(() => alive && setItems([])).finally(() => alive && setLoading(false));
      return () => { alive = false; };
    }
    return onSnapshot(
      collection(db, "announcements"),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => {
          if (a.pinned && !b.pinned) return -1;
          if (!a.pinned && b.pinned) return 1;
          return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
        });
        setItems(list);
        setLoading(false);
      },
      () => setLoading(false)
    );
  }, [authMode]);

  useEffect(() => {
    if (authMode === "api") {
      let alive = true;
      feedApi.list("general").then(({ posts = [] }) => alive && setGeneral(posts)).catch(() => alive && setGeneral([])).finally(() => alive && setGLoading(false));
      return () => { alive = false; };
    }
    return onSnapshot(
      collection(db, "generalPosts"),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => {
          if (a.pinned && !b.pinned) return -1;
          if (!a.pinned && b.pinned) return 1;
          return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
        });
        setGeneral(list);
        setGLoading(false);
      },
      () => setGLoading(false)
    );
  }, [authMode]);

  async function handlePublish(e) {
    e.preventDefault();
    setError("");
    if (!title.trim() || !body.trim()) {
      setError("Title and message are required.");
      return;
    }
    setBusy(true);
    try {
      await announcementsApi.create({
        title: title.trim(),
        body: body.trim(),
        audience,
        pinned: !!pinned,
        published: !!published,
      });
      setTitle("");
      setBody("");
      setAudience("all");
      setPinned(false);
      setPublished(true);
      setShowForm(false);
    } catch (err) {
      setError(err.message || "Could not publish.");
    } finally {
      setBusy(false);
    }
  }

  async function handleGeneralPublish(e) {
    e.preventDefault();
    setGError("");
    if (!gTitle.trim() || !gBody.trim()) {
      setGError("Title and message are required.");
      return;
    }
    setGBusy(true);
    try {
      if (authMode === "api") await feedApi.create("general", {
        title: gTitle.trim(), body: gBody.trim(), pinned: !!gPinned,
        authorName: profile?.nickname || profile?.name || "Staff",
        authorPhoto: profile?.photoURL || profile?.avatarUrl || null,
        comments: [], reactions: [],
      });
      else await addDoc(collection(db, "generalPosts"), {
        title: gTitle.trim(),
        body: gBody.trim(),
        pinned: !!gPinned,
        createdAt: serverTimestamp(),
        createdBy: user?.uid || null,
        authorName: profile?.nickname || profile?.name || "Staff",
        createdByName: profile?.name || "Staff",
        authorRole: profile?.role || "admin",
        authorPhoto: profile?.photoURL || profile?.avatarUrl || null,
        comments: [],
        reactions: [],
      });
      setGTitle("");
      setGBody("");
      setGPinned(false);
      setGShow(false);
    } catch (err) {
      setGError(err.message || "Could not publish general post.");
    } finally {
      setGBusy(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this announcement?")) return;
    try {
      await announcementsApi.remove(id);
    } catch (err) {
      alert(err.message || "Delete failed.");
    }
  }

  async function handleDeleteGeneral(id) {
    if (!window.confirm("Delete this general post?")) return;
    try {
      if (authMode === "api") await feedApi.remove("general", id);
      else await deleteDoc(doc(db, "generalPosts", id));
    } catch (err) {
      alert(err.message || "Delete failed.");
    }
  }

  async function togglePinGeneral(item) {
    try {
      if (authMode === "api") await feedApi.update("general", item.id, { pinned: !item.pinned });
      else await updateDoc(doc(db, "generalPosts", item.id), { pinned: !item.pinned });
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-text-primary">
          Announcements & General Feed
        </h1>
        <p className="text-sm text-text-secondary">
          System announcements, plus school-wide posts on every student dashboard.
        </p>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTab("announcements")}
          className={`rounded-xl px-4 py-2 text-sm font-medium ${
            tab === "announcements"
              ? "bg-accent text-bg-app"
              : "border border-border-subtle bg-bg-panel text-text-secondary"
          }`}
        >
          Announcements
        </button>
        <button
          type="button"
          onClick={() => setTab("general")}
          className={`rounded-xl px-4 py-2 text-sm font-medium ${
            tab === "general"
              ? "bg-accent text-bg-app"
              : "border border-border-subtle bg-bg-panel text-text-secondary"
          }`}
        >
          General feed
        </button>
      </div>

      {tab === "announcements" && (
        <>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setShowForm((v) => !v)}
              className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-bg-app"
            >
              <Plus size={16} />
              {showForm ? "Cancel" : "New announcement"}
            </button>
          </div>
          {showForm && (
            <form onSubmit={handlePublish} className="space-y-3 rounded-xl border border-border-subtle bg-bg-panel p-5">
              <input className={fieldClass} placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
              <textarea className={fieldClass} rows={4} placeholder="Message" value={body} onChange={(e) => setBody(e.target.value)} />
              <div className="flex flex-wrap gap-3 items-center">
                <select className={fieldClass + " max-w-xs"} value={audience} onChange={(e) => setAudience(e.target.value)}>
                  <option value="all">All users</option>
                  <option value="students">Students</option>
                  <option value="agents">Agents</option>
                </select>
                <label className="flex items-center gap-2 text-sm text-text-secondary">
                  <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
                  Pin
                </label>
                <label className="flex items-center gap-2 text-sm text-text-secondary">
                  <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
                  Publish now
                </label>
                <button type="submit" disabled={busy} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-bg-app disabled:opacity-60">
                  {busy ? "Publishing…" : "Publish"}
                </button>
              </div>
              {error && <p className="text-sm text-status-danger">{error}</p>}
            </form>
          )}
          {loading && <p className="text-sm text-text-muted">Loading…</p>}
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="rounded-xl border border-border-subtle bg-bg-panel p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-text-primary">
                      {item.pinned && <Pin size={12} className="inline text-accent mr-1" />}
                      {item.title}
                    </p>
                    <p className="mt-1 text-sm text-text-secondary whitespace-pre-wrap">{item.body}</p>
                    <p className="mt-2 text-xs text-text-muted">{item.createdByName} · {item.audience} · {item.published ? "Published" : "Draft"}</p>
                  </div>
                  <button type="button" onClick={() => handleDelete(item.id)} className="text-status-danger p-1">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === "general" && (
        <>
          <p className="text-sm text-text-secondary">
            Posts here show on every student’s dashboard under <strong>General</strong>. Students can comment; review comments below.
          </p>
          <div className="flex justify-end">
            <button type="button" onClick={() => setGShow((v) => !v)} className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-bg-app">
              <Plus size={16} />
              {gShow ? "Cancel" : "New general post"}
            </button>
          </div>
          {gShow && (
            <form onSubmit={handleGeneralPublish} className="space-y-3 rounded-xl border border-border-subtle bg-bg-panel p-5">
              <input className={fieldClass} placeholder="Title" value={gTitle} onChange={(e) => setGTitle(e.target.value)} />
              <textarea className={fieldClass} rows={4} placeholder="Message for all students" value={gBody} onChange={(e) => setGBody(e.target.value)} />
              <div className="flex flex-wrap gap-3 items-center">
                <label className="flex items-center gap-2 text-sm text-text-secondary">
                  <input type="checkbox" checked={gPinned} onChange={(e) => setGPinned(e.target.checked)} />
                  Pin to top
                </label>
                <button type="submit" disabled={gBusy} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-bg-app disabled:opacity-60">
                  {gBusy ? "Publishing…" : "Publish to General feed"}
                </button>
              </div>
              {gError && <p className="text-sm text-status-danger">{gError}</p>}
            </form>
          )}
          {gLoading && <p className="text-sm text-text-muted">Loading…</p>}
          <div className="space-y-4">
            {general.map((item) => {
              const comments = Array.isArray(item.comments) ? item.comments : [];
              const open = openComments[item.id];
              return (
                <div key={item.id} className="rounded-xl border border-border-subtle bg-bg-panel p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-text-primary">
                        {item.pinned && <Pin size={12} className="inline text-accent mr-1" />}
                        {item.title}
                      </p>
                      <p className="mt-1 text-sm text-text-secondary whitespace-pre-wrap">{item.body}</p>
                      <p className="mt-2 text-xs text-text-muted">{item.authorName || item.createdByName}</p>
                    </div>
                    <div className="flex gap-1">
                      <button type="button" onClick={() => togglePinGeneral(item)} className="p-1 text-text-muted hover:text-accent">
                        <Pin size={16} />
                      </button>
                      <button type="button" onClick={() => handleDeleteGeneral(item.id)} className="text-status-danger p-1">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpenComments((p) => ({ ...p, [item.id]: !p[item.id] }))}
                    className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-accent"
                  >
                    <MessageCircle size={13} />
                    {comments.length} student comment{comments.length !== 1 ? "s" : ""}
                  </button>
                  {open && (
                    <div className="mt-2 space-y-2 border-t border-border-subtle pt-2">
                      {comments.length === 0 && <p className="text-xs text-text-muted">No comments yet.</p>}
                      {comments.map((c) => (
                        <div key={c.id} className="rounded-lg bg-bg-panel-alt px-3 py-2">
                          <p className="text-xs font-semibold text-text-primary">{c.authorName || "Student"}</p>
                          <p className="text-xs text-text-secondary">{c.text}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
