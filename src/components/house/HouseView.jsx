import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft, ImagePlus, Loader2, Lock, LockOpen, MessageCircle, MoreHorizontal, Pencil, Pin, PinOff, Plus, Send, Shield, Trash2, Users, VolumeX, X,
} from "lucide-react";
import { housesApi, institutionTitle, plainText } from "../../lib/aspirantApi";
import { timeAgo } from "../../lib/newsApi";
import { useRealtime } from "../../lib/realtime";
import { uploadImageToCloudinary } from "../../lib/cloudinaryUpload";
import { appConfirm, notify } from "../../lib/dialogs";
import { useAuth } from "../../context/AuthContext";
import { Avatar, MentionText, MentionTextarea, useMentionField } from "./Mentions";

/** Cover band for a house: institution, motto, members, leaders. */
export function HouseHeader({ house, leaders = [], viewer, actions }) {
  return (
    <header className="house-hero">
      {house.coverUrl && <img src={house.coverUrl} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover opacity-30" />}
      <div className="relative">
        <div className="flex flex-wrap items-center gap-2">
          {viewer?.choiceRank && <span className="acx-chip is-lemon text-[11px]">{viewer.choiceRank === 1 ? "Your first choice" : "Your second choice"}</span>}
          {viewer?.isLeader && <span className="acx-chip is-aqua text-[11px]"><Shield size={11} /> You lead this house</span>}
          {viewer?.memberStatus === "muted" && <span className="acx-chip is-danger text-[11px]"><VolumeX size={11} /> Muted: read only</span>}
        </div>
        <p className="eyebrow mt-4 text-aqua">Aspirant House</p>
        <h1 className="mt-1 font-display text-[2rem] font-[380] leading-[1.05] tracking-[-0.03em] sm:text-[2.6rem]">{house.name}</h1>
        <p className="mt-2 max-w-xl text-sm text-white/70">{house.motto || `Everyone hoping to get into ${institutionTitle(house.institution)}.`}</p>
        <div className="mt-5 flex flex-wrap items-center gap-4 text-[0.82rem] text-white/75">
          <span className="inline-flex items-center gap-1.5"><Users size={14} /> {house.memberCount.toLocaleString()} aspirants</span>
          <span className="inline-flex items-center gap-1.5"><MessageCircle size={14} /> {house.threadCount} threads</span>
          {leaders.length > 0 && (
            <span className="inline-flex items-center gap-2">
              <span className="flex -space-x-2">{leaders.slice(0, 4).map((l) => <span key={l.id} className="rounded-full ring-2 ring-midnight"><Avatar person={l} size={22} /></span>)}</span>
              {leaders.length === 1 ? `Led by ${leaders[0].name}` : `${leaders.length} House Leaders`}
            </span>
          )}
        </div>
        {actions && <div className="mt-6 flex flex-wrap gap-2">{actions}</div>}
      </div>
    </header>
  );
}

/** Leader composer: title, body with @mentions, optional image, pin on post. */
export function ThreadComposer({ houseId, thread, onClose, onSaved }) {
  const isEdit = !!thread?.id;
  const field = useMentionField(houseId, true);
  const [title, setTitle] = useState(thread?.title || "");
  const [imageUrl, setImageUrl] = useState(thread?.imageUrl || "");
  const [pinned, setPinned] = useState(!!thread?.pinned);
  const [uploading, setUploading] = useState(0);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!thread) return;
    // Editing: show mentions as @Name and remember who they point to.
    const picked = [];
    const shown = thread.body.replace(/@\[([^\]\n]{1,80})\]\(user:([0-9a-f-]{36})\)/gi, (_m, name, id) => { picked.push({ id, name }); return `@${name}`; });
    field.setValue(shown);
    field.setPicked(picked);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread?.id, thread?._seed]);

  async function pickImage(file) {
    if (!file) return;
    if (!/^image\//.test(file.type)) { notify.error("Pick an image"); return; }
    setUploading(1);
    try { const r = await uploadImageToCloudinary(file, setUploading); setImageUrl(r.secure_url); }
    catch (e) { notify.error(e.message); }
    finally { setUploading(0); }
  }

  async function save() {
    if (title.trim().length < 3) { notify.error("Give the thread a title"); return; }
    if (!field.value.trim()) { notify.error("Write something"); return; }
    setBusy(true);
    try {
      const body = { title: title.trim(), body: field.serialize(), imageUrl: imageUrl || null, pinned };
      const r = isEdit ? await housesApi.updateThread(houseId, thread.id, body) : await housesApi.createThread(houseId, body);
      notify.success(isEdit ? "Thread updated" : pinned ? "Posted and pinned. Members were notified." : "Posted. Members were notified.");
      onSaved?.(r.thread);
    } catch (e) { notify.error(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-midnight/55 p-0 backdrop-blur-[2px] sm:items-center sm:p-6" role="dialog" aria-label={isEdit ? "Edit thread" : "New thread"}>
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[1.6rem] bg-bg-panel shadow-2xl sm:rounded-[1.6rem]">
        <div className="flex items-center gap-3 border-b border-border-subtle px-5 py-3.5">
          <p className="font-semibold text-text-primary">{isEdit ? "Edit thread" : "Start a thread"}</p>
          <button type="button" onClick={onClose} className="ml-auto rounded-full p-2 text-text-muted hover:bg-bg-hover" aria-label="Close"><X size={18} /></button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} placeholder="Title, e.g. Post-UTME screening dates are out" className="w-full bg-transparent font-display text-[1.6rem] leading-tight text-text-primary outline-none placeholder:text-text-muted/60" />
          <MentionTextarea field={field} rows={7} autoFocus={!isEdit} placeholder={"Share the update. Type @ to mention a member and they'll get a notification.\n\nLeave a blank line between paragraphs."} />
          {imageUrl ? (
            <div className="relative overflow-hidden rounded-2xl">
              <img src={imageUrl} alt="" className="max-h-72 w-full object-cover" />
              <button type="button" onClick={() => setImageUrl("")} className="absolute right-2 top-2 rounded-full bg-midnight/70 p-1.5 text-white" aria-label="Remove image"><X size={14} /></button>
            </div>
          ) : (
            <button type="button" onClick={() => fileRef.current?.click()} className="acx-btn-ghost">
              {uploading ? <><Loader2 size={14} className="animate-spin" /> Uploading {uploading}%</> : <><ImagePlus size={14} /> Add an image</>}
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { pickImage(e.target.files?.[0]); e.target.value = ""; }} />
          <label className="flex cursor-pointer items-center gap-3 rounded-2xl bg-lemon-soft px-4 py-3 dark:bg-lemon/10">
            <Pin size={16} className="text-midnight dark:text-lemon" />
            <span className="flex-1 text-sm">
              <span className="block font-semibold text-text-primary">Pin to the top</span>
              <span className="block text-xs text-text-secondary">Pinned posts also show on every member's dashboard.</span>
            </span>
            <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} className="h-4 w-4 accent-[#454ade]" />
          </label>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border-subtle px-5 py-3.5">
          <button type="button" onClick={onClose} className="acx-btn-ghost">Cancel</button>
          <button type="button" onClick={save} disabled={busy || !!uploading} className="acx-btn">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} {isEdit ? "Save" : "Post to house"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ThreadCard({ t, to }) {
  return (
    <Link to={to} className={`house-thread ${t.pinned ? "is-pinned" : ""}`}>
      <div className="flex items-start gap-3">
        <Avatar person={t.author} size={38} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-muted">
            <span className="font-semibold text-text-primary">{t.author?.name}</span>
            {t.author?.leader && <span className="acx-chip-sm is-aqua"><Shield size={10} /> House Leader</span>}
            <span>· {timeAgo(t.createdAt)}</span>
            {t.pinned && <span className="acx-chip-sm is-lemon"><Pin size={10} /> Pinned</span>}
            {t.locked && <span className="acx-chip-sm"><Lock size={10} /> Closed</span>}
          </div>
          <h3 className="mt-1.5 font-display text-[1.2rem] leading-snug text-text-primary">{t.title}</h3>
          <p className="mt-1 line-clamp-2 text-sm text-text-secondary">{plainText(t.body)}</p>
          {t.imageUrl && <img src={t.imageUrl} alt="" loading="lazy" className="mt-3 max-h-56 w-full rounded-2xl object-cover" />}
          <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-text-muted"><MessageCircle size={13} /> {t.replyCount ? `${t.replyCount} ${t.replyCount === 1 ? "reply" : "replies"}` : "Be the first to reply"}{t.lastReplyAt ? ` · last ${timeAgo(t.lastReplyAt)}` : ""}</p>
        </div>
      </div>
    </Link>
  );
}

/** Pinned threads first, then newest. */
export function ThreadList({ houseId, basePath, viewer, refreshKey }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [more, setMore] = useState(false);
  const [composing, setComposing] = useState(false);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setErr("");
    try { setData(await housesApi.threads(houseId)); } catch (e) { setErr(e.message); }
  }, [houseId]);
  useEffect(() => { setData(null); load(); housesApi.read(houseId).catch(() => {}); }, [load, houseId, refreshKey]);
  useRealtime(["house.thread", "reconnected"], (d) => { if (!d || !d.houseId || d.houseId === houseId) load(); });

  async function older() {
    setMore(true);
    try { const r = await housesApi.threads(houseId, { before: data.nextBefore }); setData((d) => ({ ...d, threads: [...d.threads, ...r.threads], nextBefore: r.nextBefore })); }
    finally { setMore(false); }
  }

  if (err) return <p className="rounded-2xl bg-status-danger/10 px-4 py-3 text-sm text-status-danger">{err}</p>;
  if (!data) return <div className="flex items-center gap-2 py-10 text-sm text-text-muted"><Loader2 size={16} className="animate-spin" /> Loading threads…</div>;
  const empty = !data.pinned.length && !data.threads.length;

  return (
    <div className="space-y-3">
      {viewer?.canPost && (
        <button type="button" onClick={() => setComposing(true)} className="house-compose-bar">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-lemon text-midnight"><Plus size={18} /></span>
          <span className="flex-1 text-left text-sm text-text-muted">Start a thread for the house. Type @ to mention someone.</span>
          <span className="hidden text-xs font-semibold text-accent sm:block">New thread</span>
        </button>
      )}
      {empty && (
        <div className="rounded-[1.4rem] border border-dashed border-border-strong bg-bg-panel px-6 py-14 text-center">
          <p className="font-display text-xl text-text-primary">{viewer?.canPost ? "Post the first thread" : "No threads yet"}</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-text-secondary">{viewer?.canPost ? "Welcome the house, share screening dates, or pin the cut-off marks." : "Your House Leaders will post updates here. You'll get a notification the moment they do."}</p>
        </div>
      )}
      {data.pinned.map((t) => <ThreadCard key={t.id} t={t} to={`${basePath}/t/${t.id}`} />)}
      {data.threads.map((t) => <ThreadCard key={t.id} t={t} to={`${basePath}/t/${t.id}`} />)}
      {data.nextBefore && (
        <div className="pt-2 text-center">
          <button type="button" onClick={older} disabled={more} className="acx-btn-ghost">{more ? <Loader2 size={14} className="animate-spin" /> : null} Older threads</button>
        </div>
      )}
      {composing && <ThreadComposer houseId={houseId} onClose={() => setComposing(false)} onSaved={(t) => { setComposing(false); navigate(`${basePath}/t/${t.id}`); }} />}
    </div>
  );
}

/** One thread with its replies and the reply box. */
export function ThreadView({ houseId, threadId, basePath, viewer }) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [editing, setEditing] = useState(false);
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState(false);
  const field = useMentionField(houseId, !!viewer?.canModerate);
  const endRef = useRef(null);

  const load = useCallback(async () => {
    try { setData(await housesApi.thread(houseId, threadId)); setErr(""); } catch (e) { setErr(e.message); }
  }, [houseId, threadId]);
  useEffect(() => { setData(null); load(); }, [load]);
  useRealtime(["house.reply", "house.thread", "reconnected"], (d) => { if (!d?.threadId || d.threadId === threadId) load(); });

  async function send() {
    const text = field.value.trim();
    if (!text) return;
    setBusy(true);
    try {
      const r = await housesApi.reply(houseId, threadId, { body: field.serialize() });
      setData((d) => ({ ...d, replies: [...d.replies, r.reply], thread: { ...d.thread, replyCount: d.thread.replyCount + 1 } }));
      field.reset();
      requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }));
    } catch (e) { notify.error(e.message); }
    finally { setBusy(false); }
  }
  async function act(body, done) {
    setMenu(false);
    try { const r = await housesApi.updateThread(houseId, threadId, body); setData((d) => ({ ...d, thread: r.thread })); notify.success(done); }
    catch (e) { notify.error(e.message); }
  }
  async function removeThread() {
    setMenu(false);
    if (!(await appConfirm("Delete this thread and its replies for everyone?", { tone: "danger", confirmLabel: "Delete thread" }))) return;
    try { await housesApi.deleteThread(houseId, threadId); notify.success("Thread deleted"); navigate(basePath); } catch (e) { notify.error(e.message); }
  }
  async function removeReply(r) {
    if (!(await appConfirm("Delete this reply?", { tone: "danger", confirmLabel: "Delete" }))) return;
    try { await housesApi.deleteReply(houseId, r.id); setData((d) => ({ ...d, replies: d.replies.filter((x) => x.id !== r.id), thread: { ...d.thread, replyCount: d.thread.replyCount - 1 } })); }
    catch (e) { notify.error(e.message); }
  }

  if (err) return <div className="space-y-3"><BackLink to={basePath} /><p className="rounded-2xl bg-status-danger/10 px-4 py-3 text-sm text-status-danger">{err}</p></div>;
  if (!data) return <div className="flex items-center gap-2 py-10 text-sm text-text-muted"><Loader2 size={16} className="animate-spin" /> Opening thread…</div>;
  const t = data.thread;
  const canReply = viewer?.canReply && (!t.locked || viewer?.canModerate);

  return (
    <div className="space-y-4">
      <BackLink to={basePath} />
      <article className="house-thread-open">
        <div className="flex items-start gap-3">
          <Avatar person={t.author} size={42} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-muted">
              <span className="font-semibold text-text-primary">{t.author?.name}</span>
              {t.author?.leader && <span className="acx-chip-sm is-aqua"><Shield size={10} /> House Leader</span>}
              <span>· {timeAgo(t.createdAt)}</span>
              {t.pinned && <span className="acx-chip-sm is-lemon"><Pin size={10} /> Pinned</span>}
              {t.locked && <span className="acx-chip-sm"><Lock size={10} /> Closed for replies</span>}
            </div>
            <h1 className="mt-2 font-display text-[1.7rem] leading-tight text-text-primary sm:text-[2rem]">{t.title}</h1>
          </div>
          {viewer?.canModerate && (
            <div className="relative">
              <button type="button" onClick={() => setMenu((m) => !m)} className="acx-icon-btn" aria-label="Thread options"><MoreHorizontal size={16} /></button>
              {menu && (
                <div className="absolute right-0 top-10 z-20 w-48 overflow-hidden rounded-2xl border border-border-subtle bg-bg-panel py-1 shadow-xl">
                  <MenuItem icon={Pencil} onClick={() => { setMenu(false); setEditing(true); }}>Edit</MenuItem>
                  <MenuItem icon={t.pinned ? PinOff : Pin} onClick={() => act({ pinned: !t.pinned }, t.pinned ? "Unpinned" : "Pinned. Members were notified.")}>{t.pinned ? "Unpin" : "Pin to top"}</MenuItem>
                  <MenuItem icon={t.locked ? LockOpen : Lock} onClick={() => act({ locked: !t.locked }, t.locked ? "Replies reopened" : "Replies closed")}>{t.locked ? "Reopen replies" : "Close replies"}</MenuItem>
                  <MenuItem icon={Trash2} danger onClick={removeThread}>Delete thread</MenuItem>
                </div>
              )}
            </div>
          )}
        </div>
        <MentionText text={t.body} meId={profile?.id} className="mt-4 text-[1rem] leading-relaxed text-text-primary" />
        {t.imageUrl && <img src={t.imageUrl} alt="" className="mt-4 max-h-[28rem] w-full rounded-2xl object-cover" />}
      </article>

      <section>
        <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">{t.replyCount ? `${t.replyCount} ${t.replyCount === 1 ? "reply" : "replies"}` : "Replies"}</p>
        <div className="space-y-2.5">
          {data.replies.length === 0 && <p className="rounded-2xl bg-bg-panel-alt px-4 py-5 text-center text-sm text-text-muted">No replies yet. Ask a question or say thanks.</p>}
          {data.replies.map((r) => (
            <div key={r.id} className={`house-reply ${r.author?.leader ? "is-leader" : ""}`}>
              <Avatar person={r.author} size={30} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 text-xs text-text-muted">
                  <span className="font-semibold text-text-primary">{r.author?.name}{r.mine ? " (you)" : ""}</span>
                  {r.author?.leader && <span className="acx-chip-sm is-aqua">Leader</span>}
                  <span>{timeAgo(r.createdAt)}</span>
                </div>
                <MentionText text={r.body} meId={profile?.id} className="mt-1 text-[0.93rem] leading-relaxed text-text-primary" />
              </div>
              {r.canDelete && <button type="button" onClick={() => removeReply(r)} className="self-start rounded-lg p-1.5 text-text-muted opacity-60 hover:text-status-danger hover:opacity-100" aria-label="Delete reply"><Trash2 size={13} /></button>}
            </div>
          ))}
          <div ref={endRef} />
        </div>
      </section>

      {canReply ? (
        <div className="house-reply-box">
          <MentionTextarea field={field} rows={2} placeholder={viewer?.canModerate ? "Reply, or type @ to mention a member…" : "Write a reply…"} onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send(); }} />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[11px] text-text-muted">Be kind. House Leaders can remove replies.</span>
            <button type="button" onClick={send} disabled={busy || !field.value.trim()} className="acx-btn">{busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Reply</button>
          </div>
        </div>
      ) : (
        <p className="rounded-2xl bg-bg-panel-alt px-4 py-3 text-center text-sm text-text-muted">
          {t.locked ? "This thread is closed for replies." : viewer?.memberStatus === "muted" ? "A House Leader muted you here. You can still read every thread." : "You can't reply here."}
        </p>
      )}
      {editing && <ThreadComposer houseId={houseId} thread={t} onClose={() => setEditing(false)} onSaved={(nt) => { setEditing(false); setData((d) => ({ ...d, thread: nt })); }} />}
    </div>
  );
}

function MenuItem({ icon: Icon, children, onClick, danger }) {
  return (
    <button type="button" onClick={onClick} className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm hover:bg-bg-panel-alt ${danger ? "text-status-danger" : "text-text-primary"}`}>
      <Icon size={14} /> {children}
    </button>
  );
}

export function BackLink({ to, children = "All threads" }) {
  return <Link to={to} className="inline-flex items-center gap-1.5 text-sm font-medium text-text-secondary hover:text-accent"><ArrowLeft size={15} /> {children}</Link>;
}
