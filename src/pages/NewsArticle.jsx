import ShareMenu from "../components/ShareMenu";
import { usePageMeta } from "../hooks/usePageMeta";
import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { ArrowLeft, Eye, Loader2, Lock, MessageCircle, Send, Trash2 } from "lucide-react";
import NewsShell from "../components/news/NewsShell";
import { Byline, Prose, StoryCard } from "../components/news/NewsBits";
import { REACTIONS, longDate, newsApi, timeAgo } from "../lib/newsApi";
import { useAuth } from "../context/AuthContext";
import { appConfirm, notify } from "../lib/dialogs";
import { FollowButton } from "../components/news/Follow";
import { SkeletonCards } from "../components/ui/Skeleton";

export default function NewsArticle() {
  const { slug } = useParams();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setErr("");
    try { setData(await newsApi.get(slug)); window.scrollTo(0, 0); }
    catch (e) { setErr(e.message); }
  }, [slug]);
  useEffect(() => { load(); }, [load, user]);
  usePageMeta(data?.post ? {
    title: `${data.post.title} · Academicall News`,
    description: data.post.excerpt || undefined,
    canonical: `https://academicall.site/news/${data.post.slug}`,
  } : {});

  if (err) {
    return (
      <NewsShell>
        <div className="mx-auto max-w-md py-20 text-center">
          <p className="font-display text-2xl text-ink">Story not found</p>
          <p className="mt-2 text-sm text-ink-muted">{err}</p>
          <Link to="/news" className="btn-primary mt-6 inline-flex px-5 py-2.5 text-sm">Back to the news</Link>
        </div>
      </NewsShell>
    );
  }
  if (!data) return <NewsShell><SkeletonCards label="Loading story…" /></NewsShell>;

  const { post, related } = data;
  return (
    <NewsShell title={post.title}>
      <article className="mx-auto max-w-3xl">
        <Link to="/news" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"><ArrowLeft size={15} /> All news</Link>
        <div className="mt-6 flex items-center gap-3">
          <span className="news-tag">{post.category}</span>
          {post.status !== "published" && <span className="rounded-full bg-bg-elevated px-2.5 py-0.5 text-xs text-ink-muted">{post.status === "review" ? "Waiting for approval" : post.status === "hidden" ? "Taken down" : "Draft preview"}</span>}
          <span className="text-xs text-ink-muted">{longDate(post.publishedAt)}</span>
        </div>
        <h1 className="mt-4 font-display text-[2.1rem] leading-[1.08] tracking-tight text-ink sm:text-[3rem]">{post.title}</h1>
        {post.excerpt && <p className="mt-4 text-lg leading-relaxed text-text-secondary">{post.excerpt}</p>}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-y border-border-light py-3.5">
          <Byline post={post} />
          <div className="flex items-center gap-3 text-xs text-ink-muted">
            <span className="inline-flex items-center gap-1"><Eye size={13} /> <span className="num">{post.viewCount.toLocaleString()}</span></span>
            <ShareMenu url={`https://academicall.site/news/${post.slug}`} title={post.title} text={post.excerpt || post.title} />
          </div>
        </div>

        {post.coverUrl && <img src={post.coverUrl} alt="" className="mt-7 aspect-[16/9] w-full rounded-[1.25rem] object-cover" />}

        <div className="mt-8"><Prose body={post.body} /></div>

        <div className="mt-8 flex flex-wrap items-center gap-2 rounded-2xl bg-card-light px-4 py-3 ring-1 ring-border-light">
          <p className="mr-auto text-sm text-ink"><b>Get stories like this first.</b> <span className="text-ink-muted">Follow and we'll notify you as they drop.</span></p>
          <FollowButton kind="category" value={post.category} label={post.category} size="sm" />
          {post.author?.id && <FollowButton kind="author" value={post.author.id} label={post.author.name} size="sm" />}
          {(post.tags || []).slice(0, 3).map((t) => <FollowButton key={t} kind="topic" value={t} label={`#${t}`} size="sm" />)}
        </div>

        {post.gated ? <SignInGate /> : (
          <>
            <Reactions post={post} onChange={(r) => setData((d) => ({ ...d, post: { ...d.post, ...r } }))} />
            <Comments post={post} />
          </>
        )}
      </article>

      {related?.length > 0 && (
        <section className="mx-auto mt-16 max-w-6xl">
          <div className="mb-5 flex items-center gap-3"><p className="eyebrow text-ink-muted">More in {post.category}</p><span className="h-px flex-1 bg-border-light" /></div>
          <div className="grid gap-x-7 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">{related.map((p) => <StoryCard key={p.id} post={p} />)}</div>
        </section>
      )}
    </NewsShell>
  );
}

function SignInGate() {
  const location = useLocation();
  return (
    <div className="news-gate">
      <div className="relative overflow-hidden rounded-[1.25rem] bg-midnight px-6 py-9 text-center text-white sm:px-10">
        <div className="relative">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-lemon text-midnight"><Lock size={20} /></span>
          <h2 className="mt-4 font-display text-[1.7rem] leading-tight">Sign in to <span className="serif-i text-lemon">keep reading</span></h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-white/65">Get the full story, react, and join the conversation with students across Nigeria. Once you're in, you can open the news straight away, no dashboard needed.</p>
          <div className="mt-6 flex flex-col justify-center gap-2.5 sm:flex-row">
            <Link to="/login" state={{ from: location }} className="rounded-full bg-lemon px-7 py-3 text-sm font-semibold text-midnight hover:brightness-105">Sign in to continue</Link>
            <Link to="/signup" state={{ from: location }} className="rounded-full border border-white/20 px-7 py-3 text-sm font-semibold text-white hover:bg-white/10">Create an account</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function Reactions({ post, onChange }) {
  const [busy, setBusy] = useState(false);
  async function pick(type) {
    if (busy) return;
    const nextType = post.myReaction === type ? null : type;
    const counts = { ...(post.reactions || {}) };
    if (post.myReaction) counts[post.myReaction] = Math.max(0, (counts[post.myReaction] || 1) - 1);
    if (nextType) counts[nextType] = (counts[nextType] || 0) + 1;
    onChange({ reactions: counts, myReaction: nextType, reactionTotal: Object.values(counts).reduce((a, b) => a + b, 0) });
    setBusy(true);
    try { onChange(await newsApi.react(post.id, nextType)); }
    catch (e) { notify.error(e.message); }
    finally { setBusy(false); }
  }
  return (
    <div className="mt-10 rounded-[1.25rem] border border-border-light bg-card-light p-5">
      <p className="text-sm font-medium text-ink">How did this story land?</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {REACTIONS.map((r) => (
          <button key={r.type} type="button" onClick={() => pick(r.type)} className={`news-react ${post.myReaction === r.type ? "on" : ""}`} aria-pressed={post.myReaction === r.type} title={r.label}>
            <span className="text-base leading-none">{r.emoji}</span>
            <span className="num">{post.reactions?.[r.type] || 0}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Comments({ post }) {
  const { profile } = useAuth();
  const [list, setList] = useState(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { const r = await newsApi.comments(post.id); setList(r.comments); } catch { setList([]); }
  }, [post.id]);
  useEffect(() => {
    load();
    const t = setInterval(() => !document.hidden && load(), 20000);
    return () => clearInterval(t);
  }, [load]);

  async function submit(e) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try { const r = await newsApi.comment(post.id, text.trim()); setList((l) => [...(l || []), r.comment]); setText(""); }
    catch (e2) { notify.error(e2.message); }
    finally { setBusy(false); }
  }
  async function remove(c) {
    if (!(await appConfirm("Delete this comment?", { tone: "danger", confirmLabel: "Delete" }))) return;
    try { await newsApi.deleteComment(c.id); setList((l) => l.filter((x) => x.id !== c.id)); }
    catch (e) { notify.error(e.message); }
  }

  const initials = (profile?.name || "You").slice(0, 1);
  return (
    <section className="mt-10" id="comments">
      <h2 className="flex items-center gap-2 font-display text-2xl text-ink"><MessageCircle size={20} className="text-violet" /> Comments <span className="num text-base text-ink-muted">{list ? list.length : post.commentCount}</span></h2>
      <form onSubmit={submit} className="mt-4 flex items-start gap-3">
        {profile?.photoUrl ? <img src={profile.photoUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
          : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet text-sm font-semibold text-white">{initials}</span>}
        <div className="flex-1 rounded-[1.25rem] border border-border-light bg-card-light p-2 focus-within:border-violet">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={1000} placeholder="Add to the conversation…" className="w-full resize-none bg-transparent px-2 py-1.5 text-sm text-ink outline-none placeholder:text-ink-muted" />
          <div className="flex items-center justify-between px-2 pb-1">
            <span className="text-xs text-ink-muted">{text.length}/1000</span>
            <button type="submit" disabled={busy || !text.trim()} className="btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-xs disabled:opacity-40">
              {busy ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Post
            </button>
          </div>
        </div>
      </form>
      <div className="mt-6 space-y-5">
        {!list && <Loader2 size={16} className="animate-spin text-ink-muted" />}
        {list?.length === 0 && <p className="text-sm text-ink-muted">No comments yet. Start the conversation.</p>}
        {list?.map((c) => (
          <div key={c.id} className="group flex gap-3">
            {c.author.photoUrl ? <img src={c.author.photoUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
              : <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-aqua-soft text-sm font-semibold text-aqua-deep">{(c.author.name || "S").slice(0, 1)}</span>}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold text-ink">{c.author.name}</span>
                {(c.author.newsTeam || c.author.role === "newsAgent") && <span className="rounded-full bg-lemon px-1.5 py-0.5 text-[0.7rem] font-semibold text-midnight">News team</span>}
                <span className="text-ink-muted">{timeAgo(c.createdAt)}</span>
                {c.canDelete && <button type="button" onClick={() => remove(c)} className="ml-auto text-ink-muted opacity-0 transition hover:text-status-danger group-hover:opacity-100" aria-label="Delete comment"><Trash2 size={13} /></button>}
              </div>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-text-secondary">{c.body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
