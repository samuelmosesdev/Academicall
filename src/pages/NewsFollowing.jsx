import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { ArrowLeft, BellRing, Building2, Hash, Loader2, PenLine, Plus, X } from "lucide-react";
import NewsShell from "../components/news/NewsShell";
import { useFollows } from "../components/news/Follow";
import { Switch } from "../components/access/AccessEditor";
import { NEWS_CATEGORIES } from "../lib/newsApi";
import { useAuth } from "../context/AuthContext";
import { useInstitutionSearch, institutionLabel } from "../hooks/useInstitutions";

const KIND_LABEL = { category: "Section", topic: "Topic", author: "Writer", institution: "Institution" };
const KIND_ICON = { category: BellRing, topic: Hash, author: PenLine, institution: Building2 };

/** What a reader follows. New matching stories are delivered as notifications the moment they drop. */
export default function NewsFollowing() {
  const { user, loading } = useAuth();
  const f = useFollows();
  const [topic, setTopic] = useState("");
  const [instQ, setInstQ] = useState("");
  const { results: insts } = useInstitutionSearch(instQ, { enabled: instQ.trim().length > 1 });

  if (!loading && !user) return <Navigate to="/login" replace state={{ from: { pathname: "/news/following" } }} />;
  const s = f.suggestions || {};

  return (
    <NewsShell title="Following">
      <Link to="/news" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-violet"><ArrowLeft size={15} /> All news</Link>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-violet">Subscriptions</p>
          <h1 className="mt-1 font-display text-4xl text-ink">Your news, <span className="serif-i">first-hand</span></h1>
          <p className="mt-2 max-w-xl text-sm text-ink-muted">Follow what matters to you. When a matching story is published you get a notification straight away, and it leads your For you list.</p>
        </div>
      </div>

      {!f.loaded ? <div className="mt-10 flex items-center gap-2 text-sm text-ink-muted"><Loader2 size={16} className="animate-spin" /> Loading…</div> : (
        <div className="mt-8 grid gap-8 lg:grid-cols-[1.1fr_1fr]">
          <section>
            <p className="eyebrow mb-3 text-ink-muted">Following ({f.subscriptions.length})</p>
            {f.subscriptions.length === 0 && <p className="rounded-3xl border border-dashed border-border-strong bg-card-light px-6 py-10 text-center text-sm text-ink-muted">Nothing yet. Pick a few on the right.</p>}
            <div className="space-y-2">
              {f.subscriptions.map((sub) => {
                const Icon = KIND_ICON[sub.kind] || Hash;
                return (
                  <div key={sub.id} className="flex items-center gap-3 rounded-2xl border border-border-light bg-card-light px-4 py-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-soft text-violet"><Icon size={16} /></span>
                    <div className="min-w-0 flex-1"><p className="truncate font-medium text-ink">{sub.label || sub.value}</p><p className="text-xs text-ink-muted">{KIND_LABEL[sub.kind]}</p></div>
                    <button type="button" onClick={() => f.toggle(sub.kind, sub.value)} className="rounded-full p-2 text-ink-muted hover:bg-bg-hover hover:text-status-danger" aria-label={`Unfollow ${sub.label || sub.value}`}><X size={15} /></button>
                  </div>
                );
              })}
            </div>
            <label className="mt-6 flex items-center gap-3 rounded-2xl bg-midnight px-4 py-3.5 text-white">
              <BellRing size={17} className="text-lemon" />
              <span className="flex-1 text-sm"><span className="block font-semibold">Stories picked for people like me</span><span className="text-white/65">Publishers can aim stories at aspirants, students of an institution, or a level. Get those too.</span></span>
              <Switch on={f.newsAlerts} onChange={f.setAlerts} label="Stories picked for people like me" />
            </label>
          </section>

          <section className="space-y-6">
            <div>
              <p className="eyebrow mb-3 text-ink-muted">Sections</p>
              <div className="flex flex-wrap gap-2">
                {(s.categories || NEWS_CATEGORIES).map((c) => {
                  const on = !!f.find("category", c);
                  return <button key={c} type="button" onClick={() => f.toggle("category", c, c)} className={`news-cat ${on ? "on" : ""}`}>{on ? "✓ " : "+ "}{c}</button>;
                })}
              </div>
            </div>
            <div>
              <p className="eyebrow mb-3 text-ink-muted">Topics</p>
              <form onSubmit={(e) => { e.preventDefault(); const t = topic.trim(); if (t.length >= 2) { f.toggle("topic", t, t); setTopic(""); } }} className="flex gap-2">
                <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. post-utme, nelfund, unilag" className="w-full rounded-full border border-border-light bg-card-light px-4 py-2.5 text-sm outline-none focus:border-violet" maxLength={40} />
                <button type="submit" className="btn-primary inline-flex items-center gap-1 px-4 text-sm"><Plus size={15} /> Follow</button>
              </form>
              {s.topics?.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {s.topics.filter((t) => !f.find("topic", t)).map((t) => <button key={t} type="button" onClick={() => f.toggle("topic", t, t)} className="news-cat">#{t}</button>)}
                </div>
              )}
            </div>
            <div>
              <p className="eyebrow mb-3 text-ink-muted">Institutions</p>
              <input value={instQ} onChange={(e) => setInstQ(e.target.value)} placeholder="Search an institution to follow" className="w-full rounded-full border border-border-light bg-card-light px-4 py-2.5 text-sm outline-none focus:border-violet" />
              {instQ.trim().length > 1 && (
                <div className="mt-2 max-h-56 overflow-y-auto rounded-2xl border border-border-light bg-card-light">
                  {insts.slice(0, 8).map((i) => {
                    const on = !!f.find("institution", i.id);
                    return (
                      <button key={i.id} type="button" onClick={() => f.toggle("institution", i.id, institutionLabel(i))} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-bg-hover">
                        <Building2 size={14} className="text-violet" /><span className="flex-1 truncate text-ink">{institutionLabel(i)}</span><span className="text-xs font-semibold text-violet">{on ? "Following" : "Follow"}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            {s.writers?.length > 0 && (
              <div>
                <p className="eyebrow mb-3 text-ink-muted">Writers</p>
                <div className="flex flex-wrap gap-2">
                  {s.writers.map((w) => {
                    const on = !!f.find("author", w.id);
                    return <button key={w.id} type="button" onClick={() => f.toggle("author", w.id, w.name)} className={`news-cat ${on ? "on" : ""}`}>{on ? "✓ " : "+ "}{w.name}</button>;
                  })}
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </NewsShell>
  );
}
