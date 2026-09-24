import { useState } from "react";
import { Megaphone, Loader2, Pin } from "lucide-react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import Modal from "./Modal";
import { announcementsApi } from "../lib/api";
import { db } from "../firebase/config";

const field =
  "w-full rounded-xl border border-border-light bg-card-light px-3 py-2 text-sm text-ink focus:border-teal focus:outline-none";

/**
 * Quick "Make announcement" composer used on the Department page.
 * Writes to `coursePosts` exactly like the Course Rep panel flow,
 * so students see it instantly via the live listener.
 */
export default function CreateAnnouncementModal({
  open,
  onClose,
  department,
  level,
  faculty,
  user,
  authorName,
  authMode,
}) {
  const [title, setTitle] = useState("");
  const [courseCode, setCourseCode] = useState("");
  const [body, setBody] = useState("");
  const [pinned, setPinned] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  function reset() {
    setTitle("");
    setCourseCode("");
    setBody("");
    setPinned(false);
    setErr("");
  }

  function handleClose() {
    reset();
    onClose?.();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErr("");
    if (!title.trim() || !body.trim()) {
      setErr("Title and message are required.");
      return;
    }
    setBusy(true);
    try {
      const announcement = {
        title: title.trim(),
        body: body.trim(),
        courseCode: courseCode.trim().toUpperCase() || null,
        pinned,
        audience: "department",
        faculty: faculty || null,
        department,
        level: level || null,
      };
      if (authMode === "api") {
        await announcementsApi.create(announcement);
      } else {
        await addDoc(collection(db, "announcements"), {
          ...announcement,
          published: true,
          createdBy: user?.uid || null,
          createdByName: authorName || user?.email || "Course Rep",
          createdAt: serverTimestamp(),
        });
        await addDoc(collection(db, "coursePosts"), {
          ...announcement,
          authorName: authorName || user?.email || "Course Rep",
          authorRole: user?.role || "courseRep",
          createdBy: user?.uid || null,
          createdAt: serverTimestamp(),
          comments: [],
          reactions: [],
        });
      }
      reset();
      onClose?.(true);
    } catch (ex) {
      setErr(ex.message || "Failed to post. Check Firestore rules.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Make an announcement">
      <form onSubmit={handleSubmit} className="space-y-3">
        <p className="text-xs text-ink-muted">
          Visible to students in <strong className="text-ink">{department}</strong>
          {level ? ` · ${level}` : ""} only.
        </p>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title * e.g. Test moved to Friday"
          className={field}
          required
        />
        <input
          value={courseCode}
          onChange={(e) => setCourseCode(e.target.value)}
          placeholder="Course code (optional)"
          className={field}
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          placeholder="Message *"
          className={field}
          required
        />
        <label className="inline-flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={pinned}
            onChange={(e) => setPinned(e.target.checked)}
            className="rounded border-border-light"
          />
          <Pin size={13} className="text-teal" /> Pin to top
        </label>
        {err && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{err}</p>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-xl border border-border-light px-4 py-2 text-sm font-medium text-ink-muted hover:text-ink"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-dark disabled:opacity-60"
          >
            {busy ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Megaphone size={15} />
            )}
            Post announcement
          </button>
        </div>
      </form>
    </Modal>
  );
}
