import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle, ArrowDown, ArrowLeft, BookmarkCheck, BookmarkPlus, Check, Clock, Copy, Download, FileText,
  Film, Image as ImageIcon, Info, Loader2, Lock, MoreVertical, Paperclip, RotateCw, Send, Trash2, X,
} from "lucide-react";
import { groupsApi } from "../../lib/api";
import { useRealtime } from "../../lib/realtime";
import { appConfirm, notify } from "../../lib/dialogs";
import { ACCEPT, formatBytes, imageThumb, prepareFile, uploadToCloudinary, videoPoster } from "../../lib/groupUploads";
import { downloadFile } from "../../lib/download";
import LiveIndicator from "../ui/LiveIndicator";
import { GroupAvatar, OfficialBadge, PersonAvatar, bubbleTime, dayLabel, isSameDay } from "./common";
import { setActiveGroup } from "../../hooks/useGroups";
import PdfReader from "../reader/PdfReader";

const newClientId = () =>
  (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

function mergeMessages(list, incoming) {
  const map = new Map(list.map((m) => [m.id, m]));
  for (const m of incoming) map.set(m.id, { ...map.get(m.id), ...m });
  return [...map.values()].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt) || (a.id < b.id ? -1 : 1));
}

function DocIcon({ name = "" }) {
  const ext = (name.match(/\.([a-z0-9]+)$/i)?.[1] || "doc").toUpperCase().slice(0, 4);
  return (
    <span className="flex h-11 w-9 shrink-0 flex-col items-center justify-end rounded-md bg-violet-soft pb-1 text-[9px] font-bold text-violet-deep ring-1 ring-violet/15">
      <FileText size={14} className="mb-0.5" />
      {ext}
    </span>
  );
}

function Attachment({ msg, mine, onOpenImage, onOpenPdf, onSave, saved, saving }) {
  const a = msg.attachment;
  if (!a) return null;
  if (a.withheld) {
    return (
      <div className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs ${mine ? "bg-white/15" : "bg-bg-panel-alt"}`}>
        <Lock size={15} className="shrink-0 opacity-70" />
        <span>
          <span className="block font-semibold">{a.name || "Large file"}</span>
          <span className="opacity-75">{formatBytes(a.bytes)} · large files from before you joined aren't shared</span>
        </span>
      </div>
    );
  }
  const local = msg._local;
  if (a.kind === "image") {
    const src = local?.previewUrl || imageThumb(a.url, 720);
    return (
      <button type="button" onClick={() => !local && onOpenImage(a)} className="block overflow-hidden rounded-xl bg-black/5" aria-label="Open photo">
        <img
          src={src}
          alt={a.name || "Shared photo"}
          loading="lazy"
          className="max-h-80 w-full max-w-[18rem] object-cover"
          style={a.width && a.height ? { aspectRatio: `${a.width} / ${a.height}` } : undefined}
        />
      </button>
    );
  }
  if (a.kind === "video") {
    return (
      <video
        controls
        preload="metadata"
        playsInline
        poster={local ? undefined : a.thumbnailUrl || videoPoster(a.url) || undefined}
        src={local?.previewUrl || a.url}
        className="max-h-80 w-full max-w-[18rem] rounded-xl bg-black"
      />
    );
  }
  const isPdf = /\.pdf$/i.test(a.name || "") || a.mime === "application/pdf";
  return (
    <div className={`flex w-[16.5rem] max-w-full items-center gap-3 rounded-xl px-3 py-2.5 ${mine ? "bg-white/15" : "bg-bg-panel-alt"}`}>
      <DocIcon name={a.name} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold" title={a.name}>{a.name || "Document"}</p>
        <p className="text-[11px] opacity-75">{formatBytes(a.bytes)}</p>
        {!local && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => (isPdf ? onOpenPdf(a) : downloadFile(a.url, a.name))}
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${mine ? "bg-white text-violet-deep" : "bg-violet text-white"}`}
            >
              {isPdf ? "Read" : "Download"}
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={saved || saving}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${mine ? "bg-white/20 text-white" : "bg-bg-panel text-text-primary ring-1 ring-border-subtle"} disabled:opacity-70`}
            >
              {saving ? <Loader2 size={11} className="animate-spin" /> : saved ? <BookmarkCheck size={11} /> : <BookmarkPlus size={11} />}
              {saved ? "Saved" : "Save"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function MessageMenu({ msg, canDelete, onDelete, mine }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  if (!msg.text && !canDelete) return null;
  return (
    <div ref={ref} className={`relative self-center ${open ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-within:opacity-100"} transition`}>
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex h-7 w-7 items-center justify-center rounded-full text-text-muted hover:bg-bg-panel" aria-label="Message options">
        <MoreVertical size={15} />
      </button>
      {open && (
        <div className={`absolute bottom-8 z-20 w-40 overflow-hidden rounded-xl border border-border-subtle bg-bg-panel py-1 shadow-[var(--shadow-pop)] ${mine ? "right-0" : "left-0"}`}>
          {msg.text && (
            <button type="button" onClick={() => { navigator.clipboard?.writeText(msg.text); notify.success("Copied"); setOpen(false); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-primary hover:bg-bg-panel-alt">
              <Copy size={14} /> Copy text
            </button>
          )}
          {canDelete && (
            <button type="button" onClick={() => { setOpen(false); onDelete(); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-status-danger hover:bg-status-danger/10">
              <Trash2 size={14} /> Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function GroupConversation({ groupId, me, onOpenInfo, infoOpen, onGroupLoaded, compact, refreshSignal = 0 }) {
  const navigate = useNavigate();
  const [group, setGroup] = useState(null);
  const [messages, setMessages] = useState([]);
  const [outbox, setOutbox] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [historyLocked, setHistoryLocked] = useState(false);
  const [historyAccess, setHistoryAccess] = useState("none");
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [attachOpen, setAttachOpen] = useState(false);
  const [newBelow, setNewBelow] = useState(0);
  const [lightbox, setLightbox] = useState(null);
  const [pdf, setPdf] = useState(null);
  const [saved, setSaved] = useState({});
  const [saving, setSaving] = useState({});

  const scrollRef = useRef(null);
  const atBottomRef = useRef(true);
  const restoreRef = useRef(null);
  const inputRef = useRef(null);
  const fileRefs = { image: useRef(null), video: useRef(null), document: useRef(null) };
  const readTimer = useRef(null);
  const uploads = useRef(new Map()); // clientId -> AbortController

  const isMod = group?.myRole === "creator" || group?.myRole === "moderator";

  // ── Loading ───────────────────────────────────────────────────────────────
  const loadGroup = useCallback(async () => {
    try {
      const { group: g } = await groupsApi.get(groupId);
      setGroup(g);
      onGroupLoaded?.(g);
      return g;
    } catch (err) {
      if (err.status === 403 || err.status === 404) {
        notify.error(err.message || "You no longer have access to this group");
        navigate("/dashboard/groups", { replace: true });
      }
      return null;
    }
  }, [groupId, navigate, onGroupLoaded]);

  const loadLatest = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await groupsApi.messages(groupId, { limit: 40 });
      setMessages(res.messages || []);
      setHasMore(Boolean(res.hasMore));
      setHistoryLocked(Boolean(res.historyLocked));
      setHistoryAccess(res.historyAccess || "none");
      atBottomRef.current = true;
    } catch (err) {
      setError(err.message || "Couldn't load messages");
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    setGroup(null);
    setMessages([]);
    setOutbox([]);
    setNewBelow(0);
    setText("");
    loadGroup();
    loadLatest();
    setActiveGroup(groupId, me?.uid);
    groupsApi.markRead(groupId).catch(() => {});
    return () => setActiveGroup(null);
  }, [groupId, loadGroup, loadLatest, me?.uid]);

  useEffect(() => {
    if (refreshSignal) loadGroup();
  }, [refreshSignal, loadGroup]);

  const markReadSoon = useCallback(() => {
    clearTimeout(readTimer.current);
    readTimer.current = setTimeout(() => {
      if (document.visibilityState === "visible") groupsApi.markRead(groupId).catch(() => {});
    }, 800);
  }, [groupId]);

  async function loadOlder() {
    if (loadingOlder || !hasMore || !messages.length) return;
    setLoadingOlder(true);
    const el = scrollRef.current;
    restoreRef.current = el ? { height: el.scrollHeight, top: el.scrollTop } : null;
    try {
      const oldest = messages[0];
      const res = await groupsApi.messages(groupId, { before: oldest.createdAt, beforeId: oldest.id, limit: 40 });
      setMessages((list) => mergeMessages(list, res.messages || []));
      setHasMore(Boolean(res.hasMore));
    } catch (err) {
      notify.error(err.message || "Couldn't load earlier messages");
      restoreRef.current = null;
    } finally {
      setLoadingOlder(false);
    }
  }

  // ── Scrolling ─────────────────────────────────────────────────────────────
  const scrollToBottom = (smooth = false) => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    setNewBelow(0);
  };

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (restoreRef.current) {
      el.scrollTop = el.scrollHeight - restoreRef.current.height + restoreRef.current.top;
      restoreRef.current = null;
    } else if (atBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, outbox, loading]);

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (atBottomRef.current && newBelow) setNewBelow(0);
    if (el.scrollTop < 120 && hasMore && !loadingOlder) loadOlder();
  }

  // ── Live events ───────────────────────────────────────────────────────────
  useRealtime(["group.message", "group.message.deleted", "group.updated", "group.member", "group.history", "group.removed", "reconnected", "poll"], (data, type) => {
    if (type === "reconnected" || type === "poll") {
      const last = messages[messages.length - 1];
      if (!last) return loadLatest();
      groupsApi.messages(groupId, { after: last.createdAt, limit: 80 })
        .then((res) => setMessages((list) => mergeMessages(list, res.messages || [])))
        .catch(() => {});
      loadGroup();
      return;
    }
    if (data?.groupId !== groupId) return;
    if (type === "group.message") {
      const m = data.message;
      setOutbox((box) => box.filter((o) => o.clientId !== m.clientId));
      setMessages((list) => mergeMessages(list, [m]));
      const mine = m.sender?.id === me?.uid;
      if (!atBottomRef.current && !mine) setNewBelow((n) => n + 1);
      if (mine) atBottomRef.current = true;
      markReadSoon();
      if (m.type === "system") loadGroup();
    } else if (type === "group.message.deleted") {
      setMessages((list) => list.map((m) => (m.id === data.messageId ? { ...m, deleted: true, text: null, attachment: null } : m)));
    } else if (type === "group.history") {
      if (data.historyAccess === "granted") notify.success("Earlier messages are now visible");
      loadLatest();
    } else if (type === "group.removed") {
      notify.info(data.reason === "deleted" ? "This group was deleted" : "You were removed from this group");
      navigate("/dashboard/groups", { replace: true });
    } else {
      loadGroup();
    }
  });

  // ── Sending ───────────────────────────────────────────────────────────────
  async function deliver(entry) {
    setOutbox((box) => box.map((o) => (o.clientId === entry.clientId ? { ...o, status: "sending", error: "" } : o)));
    try {
      const { message } = await groupsApi.send(groupId, { clientId: entry.clientId, text: entry.text || null, attachment: entry.remote || null });
      setOutbox((box) => box.filter((o) => o.clientId !== entry.clientId));
      setMessages((list) => mergeMessages(list, [message]));
      if (entry._local?.previewUrl) setTimeout(() => URL.revokeObjectURL(entry._local.previewUrl), 30_000);
    } catch (err) {
      setOutbox((box) => box.map((o) => (o.clientId === entry.clientId ? { ...o, status: "failed", error: err.message || "Not sent" } : o)));
    }
  }

  async function uploadAndDeliver(entry) {
    const ctrl = new AbortController();
    uploads.current.set(entry.clientId, ctrl);
    setOutbox((box) => box.map((o) => (o.clientId === entry.clientId ? { ...o, status: "uploading", progress: 0, error: "" } : o)));
    try {
      const res = await uploadToCloudinary(entry._file, entry.kind, {
        signal: ctrl.signal,
        onProgress: (p) => setOutbox((box) => box.map((o) => (o.clientId === entry.clientId ? { ...o, progress: p } : o))),
      });
      const remote = {
        url: res.secure_url,
        name: entry._file.name,
        kind: entry.kind,
        width: entry.meta.width || res.width || null,
        height: entry.meta.height || res.height || null,
        duration: entry.meta.duration || res.duration || null,
        thumbnailUrl: entry.kind === "video" ? videoPoster(res.secure_url) : null,
      };
      const next = { ...entry, remote };
      setOutbox((box) => box.map((o) => (o.clientId === entry.clientId ? next : o)));
      await deliver(next);
    } catch (err) {
      if (err.cancelled) setOutbox((box) => box.filter((o) => o.clientId !== entry.clientId));
      else setOutbox((box) => box.map((o) => (o.clientId === entry.clientId ? { ...o, status: "failed", error: err.message } : o)));
    } finally {
      uploads.current.delete(entry.clientId);
    }
  }

  function retry(entry) {
    if (entry.kind && !entry.remote) uploadAndDeliver(entry);
    else deliver(entry);
  }

  function discard(entry) {
    uploads.current.get(entry.clientId)?.abort();
    setOutbox((box) => box.filter((o) => o.clientId !== entry.clientId));
  }

  function sendText(e) {
    e?.preventDefault();
    const body = text.trim();
    if (!body) return;
    if (body.length > 4000) return notify.error("Messages can be up to 4,000 characters.");
    const entry = { clientId: newClientId(), text: body, createdAt: new Date().toISOString(), status: "sending" };
    setOutbox((box) => [...box, entry]);
    setText("");
    atBottomRef.current = true;
    deliver(entry);
    inputRef.current?.focus();
  }

  async function pickFile(kind, e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    setAttachOpen(false);
    if (!file) return;
    try {
      const prepared = await prepareFile(file, kind);
      const caption = text.trim();
      setText("");
      const entry = {
        clientId: newClientId(),
        text: caption,
        kind: prepared.kind,
        createdAt: new Date().toISOString(),
        status: "uploading",
        progress: 0,
        meta: { width: prepared.width, height: prepared.height, duration: prepared.duration },
        _file: prepared.file,
        _local: { previewUrl: prepared.kind !== "document" ? URL.createObjectURL(prepared.file) : null },
      };
      setOutbox((box) => [...box, entry]);
      atBottomRef.current = true;
      uploadAndDeliver(entry);
    } catch (err) {
      notify.error(err.message || "Couldn't attach that file");
    }
  }

  async function removeMessage(msg) {
    const ok = await appConfirm(msg.sender?.id === me?.uid ? "Delete this message for everyone?" : "Delete this message as a moderator?", { title: "Delete message", confirmLabel: "Delete", tone: "danger" });
    if (!ok) return;
    try {
      await groupsApi.deleteMessage(groupId, msg.id);
      setMessages((list) => list.map((m) => (m.id === msg.id ? { ...m, deleted: true, text: null, attachment: null } : m)));
    } catch (err) {
      notify.error(err.message || "Couldn't delete the message");
    }
  }

  async function saveToMaterials(msg) {
    setSaving((s) => ({ ...s, [msg.id]: true }));
    try {
      await groupsApi.saveMaterial(groupId, msg.id);
      setSaved((s) => ({ ...s, [msg.id]: true }));
      notify.success("Saved to your Materials", { action: { label: "Open Materials", onClick: () => navigate("/dashboard/materials") } });
    } catch (err) {
      notify.error(err.message || "Couldn't save this file");
    } finally {
      setSaving((s) => ({ ...s, [msg.id]: false }));
    }
  }

  async function askForHistory() {
    try {
      const res = await groupsApi.requestHistory(groupId);
      setHistoryAccess(res.historyAccess);
      notify.success("Request sent. A moderator will review it.");
    } catch (err) {
      notify.error(err.message || "Couldn't send the request");
    }
  }

  // ── Render helpers ────────────────────────────────────────────────────────
  const rows = useMemo(() => {
    const pending = outbox.map((o) => ({
      id: `local-${o.clientId}`,
      clientId: o.clientId,
      type: o.kind || "text",
      text: o.text,
      createdAt: o.createdAt,
      sender: { id: me?.uid, name: "You" },
      attachment: o.kind ? { kind: o.kind, name: o._file?.name, bytes: o._file?.size, width: o.meta?.width, height: o.meta?.height } : null,
      _local: o._local || {},
      _outbox: o,
    }));
    return [...messages, ...pending];
  }, [messages, outbox, me?.uid]);

  if (!group && loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 size={22} className="animate-spin text-violet" />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <header className="flex shrink-0 items-center gap-3 border-b border-border-subtle bg-bg-panel px-3 py-2.5 sm:px-4">
        {compact && (
          <button type="button" onClick={() => navigate("/dashboard/groups")} className="-ml-1 flex h-9 w-9 items-center justify-center rounded-full text-text-secondary hover:bg-bg-panel-alt" aria-label="Back to groups">
            <ArrowLeft size={19} />
          </button>
        )}
        <button type="button" onClick={onOpenInfo} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label="Group info">
          <GroupAvatar group={group} size={40} />
          <span className="min-w-0">
            <span className="flex items-center gap-2">
              <span className="truncate font-display text-[1.05rem] font-semibold text-text-primary">{group?.name}</span>
              {group?.official && <OfficialBadge className="hidden sm:inline-flex" />}
            </span>
            <span className="block truncate text-xs text-text-muted">
              {group ? `${group.memberCount} member${group.memberCount === 1 ? "" : "s"}` : ""}
              {group?.scopeLabel ? ` · ${group.scopeLabel}` : ""}
            </span>
          </span>
        </button>
        <LiveIndicator className="hidden sm:inline-flex" />
        {isMod && (group?.pendingJoinCount || 0) + (group?.pendingHistoryCount || 0) > 0 && (
          <button type="button" onClick={onOpenInfo} className="rounded-full bg-lemon px-2.5 py-1 text-[11px] font-semibold text-midnight">
            {(group.pendingJoinCount || 0) + (group.pendingHistoryCount || 0)} request{(group.pendingJoinCount || 0) + (group.pendingHistoryCount || 0) === 1 ? "" : "s"}
          </button>
        )}
        <button
          type="button"
          onClick={onOpenInfo}
          aria-pressed={infoOpen}
          className={`flex h-9 w-9 items-center justify-center rounded-full transition ${infoOpen ? "bg-violet-soft text-violet" : "text-text-secondary hover:bg-bg-panel-alt"}`}
          aria-label="Group info"
        >
          <Info size={18} />
        </button>
      </header>

      {/* Messages */}
      <div ref={scrollRef} onScroll={onScroll} className="chat-wallpaper relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-6">
        {loadingOlder && (
          <div className="flex justify-center py-2"><Loader2 size={16} className="animate-spin text-violet" /></div>
        )}
        {!hasMore && historyLocked && (
          <div className="mx-auto mb-4 max-w-sm rounded-2xl border border-border-subtle bg-bg-panel px-4 py-3 text-center text-xs text-text-secondary shadow-sm">
            <Lock size={14} className="mx-auto mb-1.5 text-violet" />
            You can see messages from when you joined.
            {historyAccess === "pending" ? (
              <p className="mt-1.5 font-semibold text-text-primary">Request sent — waiting for a moderator.</p>
            ) : historyAccess === "rejected" ? (
              <p className="mt-1.5 font-semibold text-text-primary">Your request for earlier messages was declined.</p>
            ) : (
              <button type="button" onClick={askForHistory} className="mt-2 block w-full rounded-full bg-violet px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-deep">
                Request earlier messages
              </button>
            )}
          </div>
        )}
        {error && (
          <div className="mx-auto my-6 max-w-xs text-center">
            <AlertCircle size={20} className="mx-auto mb-2 text-status-danger" />
            <p className="text-sm text-text-secondary">{error}</p>
            <button type="button" onClick={loadLatest} className="mt-3 rounded-full bg-violet px-4 py-1.5 text-xs font-semibold text-white">Try again</button>
          </div>
        )}
        {loading && !messages.length && !error && (
          <div className="flex justify-center py-10"><Loader2 size={20} className="animate-spin text-violet" /></div>
        )}

        <ol className="space-y-1">
          {rows.map((m, i) => {
            const prev = rows[i - 1];
            const showDay = !prev || !isSameDay(prev.createdAt, m.createdAt);
            const dayRow = showDay ? (
              <li key={`d-${m.id}`} className="flex justify-center py-2">
                <span className="rounded-full bg-bg-panel/90 px-3 py-1 text-[11px] font-semibold text-text-muted shadow-sm">{dayLabel(m.createdAt)}</span>
              </li>
            ) : null;
            if (m.type === "system") {
              return [
                dayRow,
                <li key={m.id} className="flex justify-center py-1">
                  <span className="max-w-[85%] rounded-full bg-lemon-soft/90 px-3 py-1 text-center text-[11px] font-medium text-midnight">{m.text}</span>
                </li>,
              ];
            }
            const mine = m.sender?.id === me?.uid;
            const firstOfRun = showDay || !prev || prev.type === "system" || prev.sender?.id !== m.sender?.id || new Date(m.createdAt) - new Date(prev.createdAt) > 5 * 60_000;
            const o = m._outbox;
            return [
              dayRow,
              <li key={m.id} className={`group flex items-end gap-2 ${mine ? "justify-end" : "justify-start"} ${firstOfRun ? "pt-2" : ""}`}>
                {!mine && (
                  <span className="w-8 shrink-0">{firstOfRun && <PersonAvatar person={m.sender} size={32} />}</span>
                )}
                {mine && !o && !m.deleted && <MessageMenu msg={m} mine canDelete onDelete={() => removeMessage(m)} />}
                <div
                  className={`max-w-[82%] rounded-2xl px-3 py-2 shadow-sm sm:max-w-[68%] ${mine ? "bubble-mine rounded-br-md" : "bubble-theirs rounded-bl-md"} ${m.fromHistory ? "opacity-90" : ""}`}
                >
                  {!mine && firstOfRun && <p className="mb-0.5 text-xs font-semibold text-violet">{m.sender?.name || "Member"}</p>}
                  {m.deleted ? (
                    <p className="text-sm italic opacity-70">This message was deleted</p>
                  ) : (
                    <>
                      {m.attachment && (
                        <div className={m.text ? "mb-1.5" : ""}>
                          <Attachment
                            msg={m}
                            mine={mine}
                            onOpenImage={setLightbox}
                            onOpenPdf={setPdf}
                            onSave={() => saveToMaterials(m)}
                            saved={saved[m.id]}
                            saving={saving[m.id]}
                          />
                        </div>
                      )}
                      {m.text && <p className="whitespace-pre-wrap break-words text-[0.92rem] leading-relaxed">{m.text}</p>}
                    </>
                  )}
                  {o?.status === "uploading" && (
                    <div className="mt-2">
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/25">
                        <div className="h-full rounded-full bg-lemon transition-all" style={{ width: `${o.progress || 0}%` }} />
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[11px] opacity-85">
                        <span>Uploading {o.progress || 0}%</span>
                        <button type="button" onClick={() => discard(o)} className="font-semibold underline">Cancel</button>
                      </div>
                    </div>
                  )}
                  {o?.status === "failed" && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px]">
                      <span className="font-semibold">{o.error || "Not sent"}</span>
                      <button type="button" onClick={() => retry(o)} className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 font-semibold text-violet-deep"><RotateCw size={11} /> Retry</button>
                      <button type="button" onClick={() => discard(o)} className="font-semibold underline">Discard</button>
                    </div>
                  )}
                  <p className={`mt-0.5 flex items-center justify-end gap-1 text-[10px] ${mine ? "text-white/75" : "text-text-muted"}`}>
                    {bubbleTime(m.createdAt)}
                    {mine && (o ? (o.status === "failed" ? <AlertCircle size={11} /> : <Clock size={11} />) : <Check size={11} />)}
                  </p>
                </div>
                {!mine && !m.deleted && <MessageMenu msg={m} canDelete={isMod} onDelete={() => removeMessage(m)} />}
              </li>,
            ];
          })}
        </ol>

        {!loading && !error && rows.length === 0 && (
          <p className="py-16 text-center text-sm text-text-muted">No messages yet. Say hello 👋</p>
        )}
      </div>

      {newBelow > 0 && (
        <div className="pointer-events-none relative">
          <button
            type="button"
            onClick={() => scrollToBottom(true)}
            className="pointer-events-auto absolute -top-14 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-midnight px-3.5 py-2 text-xs font-semibold text-lemon shadow-lg"
          >
            <ArrowDown size={13} /> {newBelow} new message{newBelow === 1 ? "" : "s"}
          </button>
        </div>
      )}

      {/* Composer */}
      <form onSubmit={sendText} className="relative flex shrink-0 items-end gap-2 border-t border-border-subtle bg-bg-panel px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-4">
        <div className="relative">
          <button
            type="button"
            onClick={() => setAttachOpen((v) => !v)}
            className={`flex h-11 w-11 items-center justify-center rounded-full transition ${attachOpen ? "bg-violet-soft text-violet" : "text-text-secondary hover:bg-bg-panel-alt"}`}
            aria-label="Attach a file"
            aria-expanded={attachOpen}
          >
            {attachOpen ? <X size={19} /> : <Paperclip size={19} />}
          </button>
          {attachOpen && (
            <div className="absolute bottom-14 left-0 z-20 w-60 overflow-hidden rounded-2xl border border-border-subtle bg-bg-panel p-1.5 shadow-[var(--shadow-pop)]">
              {[
                { kind: "image", icon: ImageIcon, label: "Photo", hint: `Up to ${group?.limits?.imageMb || 10} MB`, tone: "bg-violet-soft text-violet" },
                { kind: "video", icon: Film, label: "Short video", hint: `Up to ${Math.round((group?.limits?.videoSeconds || 180) / 60)} min · ${group?.limits?.videoMb || 25} MB`, tone: "bg-aqua-soft text-aqua-deep" },
                { kind: "document", icon: FileText, label: "Document", hint: `PDF, Word, PowerPoint · ${group?.limits?.documentMb || 20} MB`, tone: "bg-lemon-soft text-midnight" },
              ].map((o) => (
                <button key={o.kind} type="button" onClick={() => fileRefs[o.kind].current?.click()} className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left hover:bg-bg-panel-alt">
                  <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${o.tone}`}><o.icon size={17} /></span>
                  <span>
                    <span className="block text-sm font-semibold text-text-primary">{o.label}</span>
                    <span className="block text-[11px] text-text-muted">{o.hint}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
          {["image", "video", "document"].map((k) => (
            <input key={k} ref={fileRefs[k]} type="file" accept={ACCEPT[k]} className="hidden" onChange={(e) => pickFile(k, e)} />
          ))}
        </div>
        <textarea
          ref={inputRef}
          rows={1}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
          }}
          onKeyDown={(e) => {
            const touch = window.matchMedia?.("(pointer: coarse)").matches;
            if (e.key === "Enter" && !e.shiftKey && !touch) {
              e.preventDefault();
              sendText();
            }
          }}
          placeholder="Message"
          maxLength={4000}
          className="max-h-36 min-h-11 flex-1 resize-none rounded-3xl border border-border-subtle bg-bg-panel-alt px-4 py-2.5 text-[0.95rem] text-text-primary placeholder:text-text-muted focus:border-violet focus:outline-none focus:ring-2 focus:ring-violet/15"
          aria-label="Message"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-violet text-white transition hover:bg-violet-deep disabled:bg-border-strong disabled:text-text-muted"
          aria-label="Send"
        >
          <Send size={18} />
        </button>
      </form>

      {/* Photo viewer */}
      {lightbox && (
        <div className="fixed inset-0 z-[110] flex flex-col bg-midnight/95" role="dialog" aria-label="Photo">
          <div className="flex items-center justify-end gap-2 p-3">
            <button type="button" onClick={() => downloadFile(lightbox.url, lightbox.name || "photo.jpg")} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20" aria-label="Download">
              <Download size={18} />
            </button>
            <button type="button" onClick={() => setLightbox(null)} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20" aria-label="Close">
              <X size={18} />
            </button>
          </div>
          <button type="button" className="flex min-h-0 flex-1 items-center justify-center p-4" onClick={() => setLightbox(null)} aria-label="Close photo">
            <img src={imageThumb(lightbox.url, 1600)} alt={lightbox.name || ""} className="max-h-full max-w-full rounded-lg object-contain" />
          </button>
        </div>
      )}

      {/* PDF reader */}
      {pdf && (
        <div className="fixed inset-0 z-[110] flex flex-col bg-bg-app" role="dialog" aria-label={pdf.name || "Document"}>
          <div className="flex items-center gap-3 border-b border-border-subtle bg-bg-panel px-3 py-2">
            <button type="button" onClick={() => setPdf(null)} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-bg-panel-alt" aria-label="Close document">
              <ArrowLeft size={18} />
            </button>
            <p className="min-w-0 flex-1 truncate font-display text-base text-text-primary">{pdf.name}</p>
          </div>
          <div className="min-h-0 flex-1">
            <Suspense fallback={<div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-violet" /></div>}>
              <PdfReader src={pdf.url} title={pdf.name} />
            </Suspense>
          </div>
        </div>
      )}
    </div>
  );
}
