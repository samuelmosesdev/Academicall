import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AlertTriangle, Crown, Eye, ImagePlus, Loader2, MessageCircle, Pencil, Plus, Send, Target, Trash2, X } from "lucide-react";
import { ChiefReview, ChiefNewsroom, ChiefTeam } from "../components/news/ChiefDesk";
import AudiencePicker, { audienceSummary } from "../components/news/AudiencePicker";
import NewsShell from "../components/news/NewsShell";
import { Prose } from "../components/news/NewsBits";
import { NEWS_CATEGORIES, newsApi, timeAgo } from "../lib/newsApi";
import { uploadImageToCloudinary } from "../lib/cloudinaryUpload";
import { appConfirm, notify } from "../lib/dialogs";

const EMPTY = { title: "", excerpt: "", body: "", coverUrl: "", category: "Campus", tags: [], audience: null };
const STATUS_STYLE = { published: "bg-aqua-soft text-aqua-deep", review: "bg-lemon-soft text-[#6b6800]", hidden: "bg-status-danger/10 text-status-danger", draft: "bg-bg-elevated text-ink-muted" };
const STATUS_LABEL = { published: "published", review: "awaiting approval", hidden: "taken down", draft: "draft" };

/** News desk: News Agents and admins write, publish and manage stories. */
export default function NewsDesk() {
  const [params, setParams] = useSearchParams();
  const [posts, setPosts] = useState(null);
  const [editing, setEditing] = useState(null); // post | EMPTY
  const [tab, setTab] = useState("all");
  const [standing, setStanding] = useState(null);
  const [chief, setChief] = useState(false);
  const view = params.get("tab") || "mine";
  const setView = (v) => setParams(v === "mine" ? {} : { tab: v });

  async function load() {
    try { const r = await newsApi.desk(); setPosts(r.posts); setStanding(r.standing); setChief(!!r.chief); } catch (e) { notify.error(e.message); setPosts([]); }
  }
  useEffect(() => { load(); }, []);

  const shown = useMemo(() => (posts || []).filter((p) => tab === "all" || p.status === tab), [posts, tab]);
  const stats = useMemo(() => {
    const pub = (posts || []).filter((p) => p.status === "published");
    return { published: pub.length, drafts: (posts || []).length - pub.length, views: pub.reduce((a, p) => a + p.viewCount, 0), comments: pub.reduce((a, p) => a + p.commentCount, 0) };
  }, [posts]);

  async function remove(p) {
    if (!(await appConfirm(`Delete “${p.title}”? Its comments and reactions go with it.`, { tone: "danger", confirmLabel: "Delete story" }))) return;
    try { await newsApi.remove(p.id); setPosts((ps) => ps.filter((x) => x.id !== p.id)); notify.success("Story deleted"); }
    catch (e) { notify.error(e.message); }
  }

  return (
    <NewsShell title="News desk">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow inline-flex items-center gap-1.5 text-violet">{chief && <Crown size={13} />} {chief ? "Chief News Agent" : "News desk"}</p>
          <h1 className="mt-1 font-display text-4xl text-ink">{view === "mine" ? <>Your <span className="serif-i">stories</span></> : view === "review" ? <>Waiting for <span className="serif-i">approval</span></> : view === "newsroom" ? <>The <span className="serif-i">newsroom</span></> : <>News <span className="serif-i">team</span></>}</h1>
        </div>
        {standing?.newsStatus !== "suspended" && <button type="button" onClick={() => setEditing(EMPTY)} className="btn-primary inline-flex items-center gap-2 px-5 py-3 text-sm"><Plus size={16} /> Write a story</button>}
      </div>

      {chief && (
        <div className="-mx-4 mt-6 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          {[["mine", "My stories"], ["review", "Review queue"], ["newsroom", "All stories"], ["team", "News Agents"]].map(([id, label]) => (
            <button key={id} type="button" onClick={() => setView(id)} className={`news-cat ${view === id ? "on" : ""}`}>{label}</button>
          ))}
        </div>
      )}
      {standing?.newsStatus === "restricted" && (
        <div className="mt-6 flex items-start gap-3 rounded-2xl bg-lemon-soft px-4 py-3 text-sm text-ink"><AlertTriangle size={17} className="mt-0.5 shrink-0" /><p><b>Your stories need approval.</b> The Chief News Agent reviews them before they go live.{standing.newsStatusReason ? ` Note: ${standing.newsStatusReason}` : ""}</p></div>
      )}
      {standing?.newsStatus === "suspended" && (
        <div className="mt-6 flex items-start gap-3 rounded-2xl bg-status-danger/10 px-4 py-3 text-sm text-status-danger"><AlertTriangle size={17} className="mt-0.5 shrink-0" /><p><b>Your News desk access is suspended.</b> You can read your stories but can't write or publish.{standing.newsStatusReason ? ` Reason: ${standing.newsStatusReason}` : ""}</p></div>
      )}

      {chief && view === "review" && <div className="mt-6"><ChiefReview onEdit={setEditing} /></div>}
      {chief && view === "newsroom" && <div className="mt-6"><ChiefNewsroom onEdit={setEditing} /></div>}
      {chief && view === "team" && <div className="mt-6"><ChiefTeam /></div>}
      {(view === "mine" || !chief) && <>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[["Published", stats.published], ["Drafts", stats.drafts], ["Reads", stats.views], ["Comments", stats.comments]].map(([k, v]) => (
          <div key={k} className="rounded-2xl border border-border-light bg-card-light px-4 py-3.5">
            <p className="eyebrow text-ink-muted">{k}</p>
            <p className="num mt-1 text-2xl font-semibold text-ink">{v.toLocaleString()}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 flex gap-2">
        {[["all", "All"], ["published", "Published"], ["draft", "Drafts"], ["review", "Awaiting approval"], ["hidden", "Taken down"]].filter(([id]) => id === "all" || id === "published" || id === "draft" || (posts || []).some((p) => p.status === id)).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setTab(id)} className={`news-cat ${tab === id ? "on" : ""}`}>{label}</button>
        ))}
      </div>

      <div className="mt-4 overflow-hidden rounded-3xl border border-border-light bg-card-light">
        {!posts && <div className="flex items-center gap-2 p-6 text-sm text-ink-muted"><Loader2 size={16} className="animate-spin" /> Loading…</div>}
        {posts && shown.length === 0 && <p className="p-8 text-center text-sm text-ink-muted">No stories here yet. Tap “Write a story” to post the first one.</p>}
        {shown.map((p) => (
          <div key={p.id} className="flex items-center gap-4 border-b border-border-light px-4 py-3.5 last:border-0 sm:px-5">
            <div className="h-14 w-20 shrink-0 overflow-hidden rounded-xl bg-violet-soft">{p.coverUrl && <img src={p.coverUrl} alt="" className="h-full w-full object-cover" />}</div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${STATUS_STYLE[p.status] || STATUS_STYLE.draft}`}>{STATUS_LABEL[p.status] || p.status}</span>
                <span className="text-xs text-ink-muted">{p.category} · {timeAgo(p.publishedAt || p.updatedAt)}</span>
                {p.audience && <span className="inline-flex items-center gap-1 text-xs text-violet"><Target size={11} /> {audienceSummary(p.audience)}</span>}
              </div>
              <p className="mt-1 truncate font-medium text-ink">{p.title}</p>
              {p.moderationNote && p.status !== "published" && <p className="truncate text-xs text-status-danger">Chief: {p.moderationNote}</p>}
              <p className="mt-0.5 flex items-center gap-3 text-xs text-ink-muted"><span className="inline-flex items-center gap-1"><Eye size={12} /> {p.viewCount}</span><span className="inline-flex items-center gap-1"><MessageCircle size={12} /> {p.commentCount}</span><span>{p.reactionTotal} reactions</span></p>
            </div>
            <Link to={`/news/${p.slug}`} className="hidden rounded-full border border-border-light p-2 text-ink-muted hover:text-ink sm:block" title="View"><Eye size={15} /></Link>
            {p.status !== "hidden" && standing?.newsStatus !== "suspended" && <button type="button" onClick={() => setEditing(p)} className="rounded-full border border-border-light p-2 text-ink-muted hover:text-ink" title="Edit"><Pencil size={15} /></button>}
            <button type="button" onClick={() => remove(p)} className="rounded-full border border-border-light p-2 text-ink-muted hover:text-status-danger" title="Delete"><Trash2 size={15} /></button>
          </div>
        ))}
      </div>

      </>}

      {editing && <Editor post={editing} restricted={standing?.newsStatus === "restricted"} onClose={() => setEditing(null)} onSaved={(saved) => {
        setPosts((ps) => [saved, ...(ps || []).filter((x) => x.id !== saved.id)]);
        setEditing(null);
      }} />}
    </NewsShell>
  );
}

function Editor({ post, onClose, onSaved, restricted }) {
  const [form, setForm] = useState({ ...EMPTY, ...post, excerpt: post.excerpt || "", coverUrl: post.coverUrl || "", tags: post.tags || [], audience: post.audience || null });
  const [tagText, setTagText] = useState("");
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState("");
  const [uploading, setUploading] = useState(0);
  const fileRef = useRef(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function cover(file) {
    if (!file) return;
    if (!/^image\//.test(file.type)) { notify.error("Pick an image for the cover"); return; }
    setUploading(1);
    try { const r = await uploadImageToCloudinary(file, setUploading); setForm((f) => ({ ...f, coverUrl: r.secure_url })); }
    catch (e) { notify.error(e.message); }
    finally { setUploading(0); }
  }
  async function save(status) {
    setBusy(status);
    const body = { title: form.title, excerpt: form.excerpt || null, body: form.body, coverUrl: form.coverUrl || null, category: form.category, status, tags: form.tags, audience: form.audience };
    try {
      const r = post.id ? await newsApi.update(post.id, body) : await newsApi.create(body);
      notify.success(r.review ? "Sent to the Chief News Agent for approval" : status === "published" ? (form.audience ? "Published. Your audience is being notified first." : "Story published") : "Draft saved");
      onSaved(r.post);
    } catch (e) { notify.error(e.message); }
    finally { setBusy(""); }
  }

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-paper" role="dialog" aria-label="Story editor">
      <div className="flex items-center gap-3 border-b border-border-light px-4 py-3 sm:px-6">
        <button type="button" onClick={onClose} className="rounded-full p-2 text-ink-muted hover:bg-bg-hover" aria-label="Close"><X size={18} /></button>
        <p className="font-medium text-ink">{post.id ? "Edit story" : "New story"}</p>
        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={() => setPreview((p) => !p)} className="rounded-full border border-border-light px-4 py-2 text-sm text-ink">{preview ? "Edit" : "Preview"}</button>
          <button type="button" onClick={() => save("draft")} disabled={!!busy} className="hidden rounded-full border border-border-strong px-4 py-2 text-sm font-medium text-ink sm:block">{busy === "draft" ? "Saving…" : "Save draft"}</button>
          <button type="button" onClick={() => save("published")} disabled={!!busy} className="btn-primary inline-flex items-center gap-1.5 px-5 py-2 text-sm">
            {busy === "published" ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} {post.status === "published" ? "Update" : restricted ? "Send for approval" : "Publish"}
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
          {preview ? (
            <>
              <span className="news-tag">{form.category}</span>
              <h1 className="mt-4 font-display text-[2.4rem] leading-tight text-ink">{form.title || "Untitled story"}</h1>
              {form.excerpt && <p className="mt-3 text-lg text-text-secondary">{form.excerpt}</p>}
              {form.coverUrl && <img src={form.coverUrl} alt="" className="mt-6 aspect-[16/9] w-full rounded-3xl object-cover" />}
              <div className="mt-8"><Prose body={form.body} /></div>
            </>
          ) : (
            <div className="space-y-5">
              <button type="button" onClick={() => fileRef.current?.click()} className="relative flex aspect-[16/7] w-full items-center justify-center overflow-hidden rounded-3xl border border-dashed border-border-strong bg-card-light text-ink-muted hover:border-violet">
                {form.coverUrl ? <img src={form.coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover" /> : null}
                <span className={`relative inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm ${form.coverUrl ? "bg-midnight/70 text-white" : ""}`}>
                  {uploading ? <><Loader2 size={15} className="animate-spin" /> Uploading {uploading}%</> : <><ImagePlus size={16} /> {form.coverUrl ? "Change cover photo" : "Add a cover photo"}</>}
                </span>
              </button>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { cover(e.target.files?.[0]); e.target.value = ""; }} />
              <div className="flex flex-wrap gap-2">
                {NEWS_CATEGORIES.map((c) => <button key={c} type="button" onClick={() => setForm((f) => ({ ...f, category: c }))} className={`news-cat ${form.category === c ? "on" : ""}`}>{c}</button>)}
              </div>
              <textarea value={form.title} onChange={set("title")} rows={2} maxLength={140} placeholder="Headline" className="w-full resize-none bg-transparent font-display text-[2.2rem] leading-tight text-ink outline-none placeholder:text-ink-muted/50" />
              <textarea value={form.excerpt} onChange={set("excerpt")} rows={2} maxLength={240} placeholder="Standfirst: one or two sentences that sum up the story (optional)" className="w-full resize-none bg-transparent text-lg text-text-secondary outline-none placeholder:text-ink-muted/60" />
              <textarea value={form.body} onChange={set("body")} rows={16} placeholder={"Write the story…\n\nLeave a blank line between paragraphs.\n## Starts a subheading\n> Starts a pull quote\n**bold** for emphasis"} className="w-full resize-y rounded-2xl border border-border-light bg-card-light p-4 text-[1.02rem] leading-relaxed text-ink outline-none focus:border-violet" />
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">Topic tags</p>
                <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border-light bg-card-light p-2">
                  {form.tags.map((t) => <span key={t} className="inline-flex items-center gap-1 rounded-full bg-violet-soft px-2.5 py-1 text-xs font-medium text-violet">#{t}<button type="button" onClick={() => setForm((f) => ({ ...f, tags: f.tags.filter((x) => x !== t) }))} aria-label={`Remove ${t}`}><X size={11} /></button></span>)}
                  {form.tags.length < 8 && (
                    <input value={tagText} onChange={(e) => setTagText(e.target.value)} onKeyDown={(e) => {
                      if ((e.key === "Enter" || e.key === ",") && tagText.trim()) { e.preventDefault(); const t = tagText.trim().toLowerCase().replace(/^#/, "").slice(0, 30); if (t.length >= 2 && !form.tags.includes(t)) setForm((f) => ({ ...f, tags: [...f.tags, t] })); setTagText(""); }
                    }} placeholder={form.tags.length ? "Add another" : "e.g. post-utme, unilag, nelfund (Enter to add)"} className="min-w-[10rem] flex-1 bg-transparent px-2 py-1 text-sm outline-none" />
                  )}
                </div>
                <p className="mt-1 text-[11px] text-ink-muted">Readers who follow a tag get the story the moment it's published.</p>
              </div>
              <AudiencePicker value={form.audience} onChange={(audience) => setForm((f) => ({ ...f, audience }))} />
              <p className="text-xs text-ink-muted">Readers who aren't signed in see the first few paragraphs, then a prompt to sign in. Put the hook up top.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
