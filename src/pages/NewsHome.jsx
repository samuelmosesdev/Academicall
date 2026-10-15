import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ArrowRight,
  Loader2,
  Search,
  BookOpenText,
} from "lucide-react";
import NewsShell from "../components/news/NewsShell";
import { Byline, Cover, Engagement, StoryCard } from "../components/news/NewsBits";
import { NEWS_CATEGORIES, newsApi } from "../lib/newsApi";
import { useAuth } from "../context/AuthContext";

export default function NewsHome() {
  const { user } = useAuth();
  const location = useLocation();
  const [category, setCategory] = useState("All");
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [posts, setPosts] = useState(null);
  const [next, setNext] = useState(null);
  const [more, setMore] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setErr(""); setPosts(null);
    try {
      const r = await newsApi.list({ category, q: term, limit: 13 });
      setPosts(r.posts); setNext(r.nextBefore);
    } catch (e) { setErr(e.message); setPosts([]); }
  }, [category, term]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { const t = setTimeout(() => setTerm(q.trim()), 350); return () => clearTimeout(t); }, [q]);

  async function loadMore() {
    setMore(true);
    try { const r = await newsApi.list({ category, q: term, before: next, limit: 12 }); setPosts((p) => [...p, ...r.posts]); setNext(r.nextBefore); }
    finally { setMore(false); }
  }

  const lead = !term && posts?.[0];
  const side = !term ? posts?.slice(1, 4) || [] : [];
  const rest = term ? posts || [] : posts?.slice(4) || [];

  return (
    <NewsShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-violet">Academicall News</p>
          <h1 className="mt-1 font-display text-4xl leading-[1.05] text-ink sm:text-5xl">What's happening <span className="serif-i">on campus</span></h1>
        </div>
        <label className="flex w-full items-center gap-2 rounded-full border border-border-light bg-card-light px-4 py-2.5 focus-within:border-violet sm:w-72">
          <Search size={16} className="text-ink-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search stories" className="w-full bg-transparent text-sm outline-none placeholder:text-ink-muted" />
        </label>
      </div>

      <div className="-mx-4 mt-6 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {["All", ...NEWS_CATEGORIES].map((c) => (
          <button key={c} type="button" onClick={() => setCategory(c)} className={`news-cat ${category === c ? "on" : ""}`}>{c}</button>
        ))}
      </div>

      {!user && (
        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl bg-midnight px-5 py-4 text-white">
          <BookOpenText size={18} className="text-lemon" />
          <p className="flex-1 text-sm text-white/80"><span className="font-semibold text-white">Read every story in full.</span> Sign in to keep reading, react and join the conversation.</p>
          <Link to="/login" state={{ from: location }} className="rounded-full bg-lemon px-4 py-2 text-sm font-semibold text-midnight">Sign in</Link>
        </div>
      )}

      {err && <p className="mt-8 text-sm text-status-danger">{err}</p>}
      {!posts && <div className="mt-10 flex items-center gap-2 text-sm text-ink-muted"><Loader2 size={16} className="animate-spin" /> Loading the latest…</div>}
      {posts && posts.length === 0 && !err && (
        <div className="mt-10 rounded-3xl border border-dashed border-border-strong bg-card-light px-6 py-14 text-center">
          <p className="font-display text-xl text-ink">{term ? `No stories match “${term}”` : "No stories here yet"}</p>
          <p className="mt-2 text-sm text-ink-muted">Check back soon. The news team posts updates as they happen.</p>
        </div>
      )}

      {lead && (
        <section className="mt-8 grid gap-8 lg:grid-cols-[1.55fr_1fr]">
          <Link to={`/news/${lead.slug}`} className="group relative block overflow-hidden rounded-[1.75rem]">
            <Cover post={lead} eager className="aspect-[4/3] !rounded-[1.75rem] sm:aspect-[16/11]" />
            <div className="absolute inset-0 bg-gradient-to-t from-midnight via-midnight/45 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-5 sm:p-8">
              <span className="news-tag">{lead.category}</span>
              <h2 className="mt-3 font-display text-2xl leading-tight text-white sm:text-[2.35rem]">{lead.title}</h2>
              <p className="mt-2 hidden max-w-xl text-sm leading-relaxed text-white/75 sm:block">{lead.excerpt}</p>
              <div className="mt-4"><Byline post={lead} light /></div>
            </div>
          </Link>
          <div className="flex flex-col divide-y divide-border-light">
            {side.map((p) => (
              <Link key={p.id} to={`/news/${p.slug}`} className="group flex gap-4 py-4 first:pt-0">
                <div className="min-w-0 flex-1">
                  <span className="eyebrow text-violet">{p.category}</span>
                  <h3 className="mt-1 font-display text-lg leading-snug text-ink group-hover:text-violet">{p.title}</h3>
                  <div className="mt-2"><Engagement post={p} /></div>
                </div>
                <Cover post={p} className="h-20 w-24 shrink-0 !rounded-xl" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {rest.length > 0 && (
        <section className="mt-12">
          {!term && <div className="mb-5 flex items-center gap-3"><p className="eyebrow text-ink-muted">More stories</p><span className="h-px flex-1 bg-border-light" /></div>}
          <div className="grid gap-x-7 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((p) => <StoryCard key={p.id} post={p} />)}
          </div>
        </section>
      )}

      {next && (
        <div className="mt-12 text-center">
          <button type="button" onClick={loadMore} disabled={more} className="inline-flex items-center gap-2 rounded-full border border-border-strong px-6 py-3 text-sm font-medium text-ink hover:border-violet">
            {more ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />} Older stories
          </button>
        </div>
      )}
    </NewsShell>
  );
}
