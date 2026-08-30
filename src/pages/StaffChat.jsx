import { useEffect, useRef, useState, useCallback } from "react";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  limit,
} from "firebase/firestore";
import {
  MessageSquare,
  Send,
  Image as ImageIcon,
  Mic,
  Square,
  Loader2,
  CalendarPlus,
  MapPin,
  Clock,
  Users,
  Pencil,
  Trash2,
  Check,
  X,
  Reply,
} from "lucide-react";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import UserAvatar, { displayLabel, NameWithBadge } from "../components/UserAvatar";
import Modal from "../components/Modal";
import {
  uploadImageToCloudinary,
  uploadVoiceToCloudinary,
} from "../lib/cloudinaryUpload";
import { isAdmin } from "../lib/roles";
import { useStaffChatUnread } from "../hooks/useStaffChatUnread";
import { chatApi } from "../lib/api";

const REACTIONS = [
  { type: "like", emoji: "👍" },
  { type: "love", emoji: "❤️" },
  { type: "haha", emoji: "😂" },
  { type: "check", emoji: "✅" },
];

const field =
  "w-full rounded-xl border border-border-subtle bg-bg-app px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none";

function msgTime(m) {
  const ts = m.createdAt;
  if (ts?.toMillis) return ts.toMillis();
  if (ts?.seconds) return ts.seconds * 1000;
  if (m.clientAt) return new Date(m.clientAt).getTime() || 0;
  return 0;
}

function formatTime(ts, clientAt) {
  const d = ts?.toDate
    ? ts.toDate()
    : clientAt
      ? new Date(clientAt)
      : ts
        ? new Date(ts)
        : null;
  if (!d || Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ReactionChip({ reactions, myUid, onToggle }) {
  const [open, setOpen] = useState(false);
  const counts = {};
  (reactions || []).forEach((r) => {
    counts[r.type] = (counts[r.type] || 0) + 1;
  });
  const mine = (reactions || []).find((r) => r.uid === myUid)?.type || null;
  const present = REACTIONS.filter((r) => counts[r.type] > 0);
  const total = (reactions || []).length;

  return (
    <div className="relative inline-flex items-center gap-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition ${
          mine
            ? "border-accent/40 bg-accent-soft text-accent"
            : "border-border-subtle bg-bg-panel-alt text-text-muted hover:border-accent/30"
        }`}
      >
        {present.length > 0 ? (
          <>
            <span className="flex -space-x-0.5">
              {present.slice(0, 3).map((r) => (
                <span key={r.type}>{r.emoji}</span>
              ))}
            </span>
            <span className="font-semibold tabular-nums">{total}</span>
          </>
        ) : (
          <span>😊 React</span>
        )}
      </button>
      {open && (
        <div className="absolute bottom-full left-0 z-20 mb-1 flex gap-0.5 rounded-full border border-border-subtle bg-bg-panel px-1.5 py-1 shadow-lg">
          {REACTIONS.map(({ type, emoji }) => (
            <button
              key={type}
              type="button"
              onClick={() => {
                onToggle(type);
                setOpen(false);
              }}
              className={`flex h-8 w-8 items-center justify-center rounded-full text-base transition hover:scale-110 ${
                mine === type ? "bg-accent-soft" : "hover:bg-bg-panel-alt"
              }`}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function StaffChat() {
  const { user, profile, authMode } = useAuth();
  const admin = isAdmin(profile);
  const { markStaffChatRead } = useStaffChatUnread();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const [uploadPct, setUploadPct] = useState(0);
  const [showMeeting, setShowMeeting] = useState(false);
  const [meetForm, setMeetForm] = useState({
    title: "",
    startsAt: "",
    endsAt: "",
    venue: "",
    notes: "",
  });
  const [meetBusy, setMeetBusy] = useState(false);
  const [meetErr, setMeetErr] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [menuId, setMenuId] = useState(null);
  const [replyTo, setReplyTo] = useState(null);

  const bottomRef = useRef(null);
  const fileRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const recTimerRef = useRef(null);
  const stickBottom = useRef(true);

  // Mark read once per visit, not once per render. Keyed on uid rather than on
  // the callback identity so a re-render can never re-trigger the write.
  useEffect(() => {
    if (!user?.uid) return;
    markStaffChatRead?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  // Live listener — keep all docs; sort client-side so nothing vanishes on timestamp lag
  useEffect(() => {
    if (authMode === "api") {
      let alive = true;
      chatApi.list().then(({ messages: list = [] }) => {
        if (!alive) return;
        setMessages(list);
        setLoading(false);
      }).catch(() => alive && setLoading(false));
      return () => { alive = false; };
    }
    const q = query(
      collection(db, "staffChat"),
      orderBy("createdAt", "asc"),
      limit(300)
    );

    const applySnap = (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => msgTime(a) - msgTime(b));
      setMessages(list);
      setLoading(false);
    };

    // Firestore ignores whatever an error callback returns, so a listener
    // created in there can never be torn down. Park it on a ref the cleanup
    // below can actually reach.
    let fallbackUnsub = null;

    const unsub = onSnapshot(q, applySnap, (err) => {
      console.error("staffChat listener", err);
      // Fallback without orderBy if index missing — still keep messages
      fallbackUnsub?.();
      fallbackUnsub = onSnapshot(
        query(collection(db, "staffChat"), limit(300)),
        applySnap,
        () => setLoading(false)
      );
    });

    return () => {
      unsub();
      fallbackUnsub?.();
    };
  }, [authMode]);

  useEffect(() => {
    if (stickBottom.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length]);

  const authorMeta = useCallback(() => {
    return {
      authorUid: user?.uid,
      authorName: displayLabel(profile, user?.email || "Staff"),
      authorRole: profile?.role || "agent",
      authorPhoto: profile?.photoURL || profile?.avatarUrl || null,
      authorPlan: profile?.plan || null,
      authorSubscription: profile?.subscription || null,
    };
  }, [user, profile]);

  async function sendText(e) {
    e?.preventDefault?.();
    const body = text.trim();
    if (!body || !user || sending) return;
    setSending(true);
    stickBottom.current = true;
    const clientAt = new Date().toISOString();
    try {
      const payload = {
        type: "text",
        text: body,
        ...authorMeta(),
        reactions: [],
        deleted: false,
        edited: false,
        clientAt,
        replyTo: replyTo
          ? {
              id: replyTo.id,
              authorName: replyTo.authorName,
              type: replyTo.type,
              text: replyTo.text,
            }
          : null,
      };
      if (authMode === "api") {
        const { message } = await chatApi.create(payload);
        setMessages((current) => [...current, message]);
      } else await addDoc(collection(db, "staffChat"), { ...payload, createdAt: serverTimestamp() });
      setText("");
      setReplyTo(null);
    } catch (err) {
      alert(err.message || "Could not send message.");
    } finally {
      setSending(false);
    }
  }

  async function sendImage(file) {
    if (!file || !user) return;
    setSending(true);
    setUploadPct(0);
    stickBottom.current = true;
    const clientAt = new Date().toISOString();
    try {
      const res = await uploadImageToCloudinary(file, setUploadPct);
      const payload = {
        type: "image",
        text: text.trim() || null,
        mediaUrl: res.secure_url,
        mediaWidth: res.width || null,
        mediaHeight: res.height || null,
        ...authorMeta(),
        reactions: [],
        deleted: false,
        edited: false,
        clientAt,
      };
      if (authMode === "api") {
        const { message } = await chatApi.create(payload);
        setMessages((current) => [...current, message]);
      } else await addDoc(collection(db, "staffChat"), { ...payload, createdAt: serverTimestamp() });
      setText("");
    } catch (err) {
      alert(err.message || "Image upload failed.");
    } finally {
      setSending(false);
      setUploadPct(0);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function toggleReaction(msgId, type) {
    if (!user) return;
    const msg = messages.find((m) => m.id === msgId);
    if (!msg || msg.deleted) return;
    let reactions = Array.isArray(msg.reactions) ? [...msg.reactions] : [];
    const idx = reactions.findIndex((r) => r.uid === user.uid);
    if (idx >= 0) {
      if (reactions[idx].type === type) reactions.splice(idx, 1);
      else reactions[idx] = { uid: user.uid, type };
    } else {
      reactions.push({ uid: user.uid, type });
    }
    try {
      if (authMode === "api") await chatApi.update(msgId, { reactions });
      else await updateDoc(doc(db, "staffChat", msgId), { reactions });
    } catch (err) {
      alert(err.message || "Could not react.");
    }
  }

  function startReply(msg) {
    if (msg.deleted) return;
    const preview =
      msg.type === "text"
        ? (msg.text || "").slice(0, 120)
        : msg.type === "image"
          ? "Photo"
          : msg.type === "voice"
            ? "Voice note"
            : msg.type === "meeting"
              ? msg.meeting?.title || "Meeting"
              : "Message";
    setReplyTo({
      id: msg.id,
      authorName: msg.authorName || "Staff",
      type: msg.type,
      text: preview,
    });
    setMenuId(null);
  }

  async function softDelete(msg) {
    if (!user) return;
    const mine = msg.authorUid === user.uid;
    if (!mine && !admin) return;
    if (!window.confirm(mine ? "Delete this message?" : "Delete this message as admin?")) return;
    try {
      const payload = {
        deleted: true,
        deletedAt: new Date().toISOString(),
        deletedBy: user.uid,
        deletedByName: displayLabel(profile, "Staff"),
        deletedByRole: profile?.role || "admin",
      };
      if (authMode === "api") await chatApi.update(msg.id, payload);
      else await updateDoc(doc(db, "staffChat", msg.id), payload);
      setMenuId(null);
    } catch (err) {
      alert(err.message || "Could not delete.");
    }
  }

  async function saveEdit(msg) {
    const body = editText.trim();
    if (!body || msg.authorUid !== user?.uid) return;
    try {
      if (authMode === "api") await chatApi.update(msg.id, { text: body, edited: true, editedAt: new Date().toISOString() });
      else await updateDoc(doc(db, "staffChat", msg.id), {
        text: body,
        edited: true,
        editedAt: serverTimestamp(),
      });
      setEditingId(null);
      setEditText("");
    } catch (err) {
      alert(err.message || "Could not edit.");
    }
  }

  async function startRecording() {
    if (recording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mime });
        const duration = recSeconds;
        setRecSeconds(0);
        if (blob.size < 500) return;
        setSending(true);
        setUploadPct(0);
        stickBottom.current = true;
        const clientAt = new Date().toISOString();
        try {
          const file = new File(
            [blob],
            `voice-${Date.now()}.${mime.includes("webm") ? "webm" : "m4a"}`,
            { type: mime }
          );
          const res = await uploadVoiceToCloudinary(file, setUploadPct);
          const payload = {
            type: "voice",
            mediaUrl: res.secure_url,
            mediaDuration: duration,
            ...authorMeta(),
            reactions: [],
            deleted: false,
            edited: false,
            clientAt,
          };
          if (authMode === "api") {
            const { message } = await chatApi.create(payload);
            setMessages((current) => [...current, message]);
          } else await addDoc(collection(db, "staffChat"), { ...payload, createdAt: serverTimestamp() });
        } catch (err) {
          alert(err.message || "Voice note failed.");
        } finally {
          setSending(false);
          setUploadPct(0);
        }
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setRecording(true);
      setRecSeconds(0);
      recTimerRef.current = setInterval(() => {
        setRecSeconds((s) => s + 1);
      }, 1000);
    } catch {
      alert("Microphone permission is required for voice notes.");
    }
  }

  function stopRecording() {
    if (!recording) return;
    clearInterval(recTimerRef.current);
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }

  async function scheduleMeeting(e) {
    e.preventDefault();
    setMeetErr("");
    if (!meetForm.title.trim() || !meetForm.startsAt) {
      setMeetErr("Title and start time are required.");
      return;
    }
    setMeetBusy(true);
    const clientAt = new Date().toISOString();
    try {
      const startsAt = new Date(meetForm.startsAt);
      const endsAt = meetForm.endsAt ? new Date(meetForm.endsAt) : null;
      const payload = {
        type: "meeting",
        text: meetForm.notes.trim() || null,
        meeting: {
          title: meetForm.title.trim(),
          startsAt: startsAt.toISOString(),
          endsAt: endsAt ? endsAt.toISOString() : null,
          venue: meetForm.venue.trim() || null,
        },
        ...authorMeta(),
        reactions: [],
        deleted: false,
        edited: false,
        clientAt,
      };
      if (authMode === "api") {
        const { message } = await chatApi.create(payload);
        setMessages((current) => [...current, message]);
      } else await addDoc(collection(db, "staffChat"), { ...payload, createdAt: serverTimestamp() });
      setMeetForm({ title: "", startsAt: "", endsAt: "", venue: "", notes: "" });
      setShowMeeting(false);
      stickBottom.current = true;
    } catch (err) {
      setMeetErr(err.message || "Could not schedule meeting.");
    } finally {
      setMeetBusy(false);
    }
  }

  // Non-admins never see soft-deleted; admin sees all
  const visible = messages.filter((m) => admin || !m.deleted);

  return (
    /* Full-bleed within the shell: break out of main padding */
    <div
      className="staff-hq-root fixed inset-0 z-30 flex flex-col bg-bg-app lg:left-64"
      style={{ top: 0 }}
    >
      {/* Pinned top bar */}
      <header className="z-20 flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border-subtle bg-bg-panel px-4 py-3 shadow-sm sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-bg-app">
            <MessageSquare size={18} />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold text-text-primary sm:text-lg">
              Staff HQ
            </h1>
            <p className="flex items-center gap-1 text-[11px] text-text-muted">
              <Users size={11} /> Admin · Alpha · Agents · live
            </p>
          </div>
        </div>
        {admin && (
          <button
            type="button"
            onClick={() => setShowMeeting(true)}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-bg-app sm:text-sm"
          >
            <CalendarPlus size={15} />
            <span className="hidden sm:inline">Schedule meeting</span>
            <span className="sm:hidden">Meeting</span>
          </button>
        )}
      </header>

      {/* Message list — fills remaining height */}
      <div
        className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-4 sm:px-5"
        onScroll={(e) => {
          const el = e.currentTarget;
          const nearBottom =
            el.scrollHeight - el.scrollTop - el.clientHeight < 80;
          stickBottom.current = nearBottom;
        }}
      >
        {loading && (
          <p className="flex items-center justify-center gap-2 py-16 text-sm text-text-muted">
            <Loader2 size={16} className="animate-spin" /> Loading conversation…
          </p>
        )}
        {!loading && visible.length === 0 && (
          <div className="rounded-xl border border-dashed border-border-subtle px-4 py-16 text-center text-sm text-text-muted">
            No messages yet. Say hello to the team — messages stay here for everyone.
          </div>
        )}
        {visible.map((m) => {
          const mine = m.authorUid === user?.uid;
          const isDeleted = !!m.deleted;
          return (
            <div
              key={m.id}
              className={`flex gap-2.5 touch-pan-y select-none ${mine ? "flex-row-reverse" : ""} ${
                isDeleted ? "opacity-70" : ""
              }`}
              onPointerDown={(e) => {
                if (isDeleted) return;
                e.currentTarget._sx = e.clientX;
                e.currentTarget._armed = false;
              }}
              onPointerMove={(e) => {
                if (isDeleted || e.currentTarget._sx == null) return;
                const dx = e.clientX - e.currentTarget._sx;
                if ((!mine && dx > 56) || (mine && dx < -56)) {
                  e.currentTarget._armed = true;
                }
              }}
              onPointerUp={(e) => {
                if (e.currentTarget._armed && !isDeleted) startReply(m);
                e.currentTarget._sx = null;
                e.currentTarget._armed = false;
              }}
              onPointerCancel={(e) => {
                e.currentTarget._sx = null;
                e.currentTarget._armed = false;
              }}
            >
              <UserAvatar
                name={m.authorName}
                photoURL={m.authorPhoto}
                role={m.authorRole}
                plan={m.authorPlan}
                subscription={m.authorSubscription}
                size={34}
              />
              <div
                className={`max-w-[min(100%,28rem)] space-y-1 ${
                  mine ? "items-end text-right" : ""
                }`}
              >
                <div
                  className={`inline-flex flex-wrap items-center gap-1.5 text-[11px] text-text-muted ${
                    mine ? "justify-end" : ""
                  }`}
                >
                  <NameWithBadge
                    name={m.authorName || "Staff"}
                    role={m.authorRole}
                    plan={m.authorPlan}
                    subscription={m.authorSubscription}
                  />
                  <span>· {formatTime(m.createdAt, m.clientAt)}</span>
                  {m.edited && !isDeleted && (
                    <span className="italic">(edited)</span>
                  )}
                  {isDeleted && admin && (
                    <span className="rounded bg-status-danger/15 px-1.5 py-0.5 text-[10px] font-semibold text-status-danger">
                      Deleted
                      {m.deletedByName ? ` · ${m.deletedByName}` : ""}
                    </span>
                  )}
                </div>

                {m.replyTo && !isDeleted && (
                  <div
                    className={`mb-1 rounded-xl border-l-2 border-accent/60 bg-bg-panel-alt/80 px-2.5 py-1.5 text-left text-[11px] ${
                      mine ? "ml-auto" : ""
                    }`}
                  >
                    <p className="font-semibold text-accent">
                      {m.replyTo.authorName || "Staff"}
                    </p>
                    <p className="truncate text-text-muted">
                      {m.replyTo.text || "Message"}
                    </p>
                  </div>
                )}

                {isDeleted && admin ? (
                  <div className="rounded-2xl border border-dashed border-status-danger/30 bg-bg-panel-alt px-3.5 py-2.5 text-left text-sm text-text-muted line-through">
                    {m.type === "text" && (m.text || "—")}
                    {m.type === "image" && "[Image]"}
                    {m.type === "voice" && "[Voice note]"}
                    {m.type === "meeting" &&
                      `[Meeting] ${m.meeting?.title || ""}`}
                  </div>
                ) : (
                  <>
                    {m.type === "meeting" && m.meeting && (
                      <div className="rounded-2xl border border-accent/30 bg-accent-soft/40 px-4 py-3 text-left">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-accent">
                          Team meeting
                        </p>
                        <p className="mt-1 text-sm font-semibold text-text-primary">
                          {m.meeting.title}
                        </p>
                        <div className="mt-2 space-y-1 text-xs text-text-secondary">
                          <p className="flex items-center gap-1.5">
                            <Clock size={12} />
                            {new Date(m.meeting.startsAt).toLocaleString()}
                            {m.meeting.endsAt
                              ? ` – ${new Date(m.meeting.endsAt).toLocaleTimeString()}`
                              : ""}
                          </p>
                          {m.meeting.venue && (
                            <p className="flex items-center gap-1.5">
                              <MapPin size={12} /> {m.meeting.venue}
                            </p>
                          )}
                        </div>
                        {m.text && (
                          <p className="mt-2 whitespace-pre-wrap text-xs text-text-muted">
                            {m.text}
                          </p>
                        )}
                      </div>
                    )}

                    {m.type === "text" && editingId === m.id && (
                      <div className="space-y-2 text-left">
                        <textarea
                          className={field}
                          rows={2}
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => saveEdit(m)}
                            className="inline-flex items-center gap-1 rounded-lg bg-accent px-2.5 py-1 text-xs font-semibold text-bg-app"
                          >
                            <Check size={12} /> Save
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(null);
                              setEditText("");
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-border-subtle px-2.5 py-1 text-xs text-text-secondary"
                          >
                            <X size={12} /> Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {m.type === "text" && editingId !== m.id && (
                      <div
                        className={`rounded-2xl px-3.5 py-2.5 text-left text-sm leading-relaxed whitespace-pre-wrap ${
                          mine
                            ? "rounded-br-md bg-accent text-bg-app"
                            : "rounded-bl-md bg-bg-panel-alt text-text-primary"
                        }`}
                      >
                        {m.text}
                      </div>
                    )}

                    {m.type === "image" && m.mediaUrl && (
                      <div className="overflow-hidden rounded-2xl border border-border-subtle bg-bg-panel-alt text-left">
                        <a href={m.mediaUrl} target="_blank" rel="noreferrer">
                          <img
                            src={m.mediaUrl}
                            alt=""
                            className="max-h-64 w-full object-cover"
                          />
                        </a>
                        {m.text && (
                          <p className="whitespace-pre-wrap px-3 py-2 text-sm text-text-secondary">
                            {m.text}
                          </p>
                        )}
                      </div>
                    )}

                    {m.type === "voice" && m.mediaUrl && (
                      <div className="rounded-2xl border border-border-subtle bg-bg-panel-alt px-3 py-2.5 text-left">
                        <audio
                          controls
                          src={m.mediaUrl}
                          className="h-9 w-full max-w-xs"
                        />
                        {m.mediaDuration != null && (
                          <p className="mt-1 text-[10px] text-text-muted">
                            {m.mediaDuration}s voice note
                          </p>
                        )}
                      </div>
                    )}
                  </>
                )}

                {!isDeleted && (
                  <div
                    className={`flex flex-wrap items-center gap-2 ${
                      mine ? "justify-end" : ""
                    }`}
                  >
                    <ReactionChip
                      reactions={m.reactions}
                      myUid={user?.uid}
                      onToggle={(type) => toggleReaction(m.id, type)}
                    />
                    {(mine || admin) && (
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() =>
                            setMenuId((id) => (id === m.id ? null : m.id))
                          }
                          className="rounded px-1.5 text-[11px] text-text-muted hover:text-text-primary"
                        >
                          ···
                        </button>
                        {menuId === m.id && (
                          <div
                            className={`absolute z-20 mt-1 min-w-[120px] rounded-xl border border-border-subtle bg-bg-panel py-1 shadow-lg ${
                              mine ? "right-0" : "left-0"
                            }`}
                          >
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-text-primary hover:bg-bg-panel-alt"
                              onClick={() => startReply(m)}
                            >
                              <Reply size={12} /> Reply
                            </button>
                            {mine && m.type === "text" && (
                              <button
                                type="button"
                                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-text-primary hover:bg-bg-panel-alt"
                                onClick={() => {
                                  setEditingId(m.id);
                                  setEditText(m.text || "");
                                  setMenuId(null);
                                }}
                              >
                                <Pencil size={12} /> Edit
                              </button>
                            )}
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-status-danger hover:bg-bg-panel-alt"
                              onClick={() => softDelete(m)}
                            >
                              <Trash2 size={12} /> Delete
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Composer pinned bottom */}
      <div className="shrink-0 border-t border-border-subtle bg-bg-panel px-3 py-3 sm:px-4">
        {replyTo && (
          <div className="mb-2 flex items-start gap-2 rounded-xl border border-accent/25 bg-accent-soft/40 px-3 py-2">
            <Reply size={14} className="mt-0.5 shrink-0 text-accent" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold text-accent">
                Replying to {replyTo.authorName}
              </p>
              <p className="truncate text-xs text-text-muted">{replyTo.text}</p>
            </div>
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              className="rounded p-0.5 text-text-muted hover:text-text-primary"
              aria-label="Cancel reply"
            >
              <X size={14} />
            </button>
          </div>
        )}
        {(sending || uploadPct > 0) && (
          <p className="mb-2 flex items-center gap-2 text-xs text-text-muted">
            <Loader2 size={12} className="animate-spin" />
            {uploadPct > 0 ? `Uploading… ${uploadPct}%` : "Sending…"}
          </p>
        )}
        {recording && (
          <p className="mb-2 flex items-center gap-2 text-xs font-medium text-status-danger">
            <span className="h-2 w-2 animate-pulse rounded-full bg-status-danger" />
            Recording {recSeconds}s — tap stop when done
          </p>
        )}
        <form onSubmit={sendText} className="flex items-end gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) sendImage(f);
            }}
          />
          <button
            type="button"
            title="Send image"
            disabled={sending || recording}
            onClick={() => fileRef.current?.click()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border-subtle text-text-secondary hover:bg-bg-panel-alt hover:text-accent disabled:opacity-50"
          >
            <ImageIcon size={18} />
          </button>
          <button
            type="button"
            title={recording ? "Stop recording" : "Voice note"}
            disabled={sending}
            onClick={() => (recording ? stopRecording() : startRecording())}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border disabled:opacity-50 ${
              recording
                ? "border-status-danger/40 bg-status-danger/10 text-status-danger"
                : "border-border-subtle text-text-secondary hover:bg-bg-panel-alt hover:text-accent"
            }`}
          >
            {recording ? <Square size={16} /> : <Mic size={18} />}
          </button>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendText();
              }
            }}
            rows={1}
            placeholder="Message the team…"
            className={`${field} max-h-28 min-h-[2.5rem] resize-y`}
            disabled={sending || recording}
          />
          <button
            type="submit"
            disabled={sending || recording || !text.trim()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-bg-app hover:opacity-95 disabled:opacity-50"
          >
            <Send size={16} />
          </button>
        </form>
      </div>

      <Modal
        open={showMeeting}
        onClose={() => setShowMeeting(false)}
        title="Schedule team meeting"
      >
        <form onSubmit={scheduleMeeting} className="space-y-3">
          <p className="text-xs text-text-muted">
            Posts into Staff HQ so every Admin and Agent sees it.
          </p>
          <input
            className={field}
            placeholder="Meeting title *"
            value={meetForm.title}
            onChange={(e) =>
              setMeetForm((p) => ({ ...p, title: e.target.value }))
            }
            required
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-text-muted">Start *</label>
              <input
                type="datetime-local"
                className={field}
                value={meetForm.startsAt}
                onChange={(e) =>
                  setMeetForm((p) => ({ ...p, startsAt: e.target.value }))
                }
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-text-muted">End</label>
              <input
                type="datetime-local"
                className={field}
                value={meetForm.endsAt}
                onChange={(e) =>
                  setMeetForm((p) => ({ ...p, endsAt: e.target.value }))
                }
              />
            </div>
          </div>
          <input
            className={field}
            placeholder="Venue / Meet / Zoom link"
            value={meetForm.venue}
            onChange={(e) =>
              setMeetForm((p) => ({ ...p, venue: e.target.value }))
            }
          />
          <textarea
            className={field}
            rows={2}
            placeholder="Agenda / notes (optional)"
            value={meetForm.notes}
            onChange={(e) =>
              setMeetForm((p) => ({ ...p, notes: e.target.value }))
            }
          />
          {meetErr && (
            <p className="rounded-lg bg-status-danger/10 px-3 py-2 text-xs text-status-danger">
              {meetErr}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowMeeting(false)}
              className="rounded-xl border border-border-subtle px-4 py-2 text-sm text-text-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={meetBusy}
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-bg-app disabled:opacity-60"
            >
              {meetBusy ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <CalendarPlus size={14} />
              )}
              Post meeting
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
