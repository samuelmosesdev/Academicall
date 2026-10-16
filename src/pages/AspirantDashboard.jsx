import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Building2, ChevronLeft, ChevronRight, Compass, Loader2, MessageCircle, Newspaper, Pin, Settings2, Users } from "lucide-react";
import { aspirantApi, institutionTitle, plainText } from "../lib/aspirantApi";
import { newsApi, timeAgo } from "../lib/newsApi";
import { useRealtime } from "../lib/realtime";
import { useAuth } from "../context/AuthContext";
import { Avatar } from "../components/house/Mentions";

/**
 * Aspirant dashboard. The top shows what House Leaders chose to post and pin,
 * then the aspirant's institutions of choice, their houses, and news picked for aspirants.
 */
export default function AspirantDashboard() {
  const { profile } = useAuth();
  const [data, setData] = useState(null);
  const [news, setNews] = useState(null);
  const [err, setErr] = useState("");
  const first = profile?.nickname || profile?.name?.split(" ")[0] || "there";

  const load = useCallback(() => aspirantApi.me().then((d) => { setData(d); setErr(""); }).catch((e) => setErr(e.message)), []);
  useEffect(() => { load(); newsApi.forYou().then((r) => setNews(r.posts || [])).catch(() => setNews([])); }, [load]);
  useRealtime(["house.thread", "house.removed", "reconnected"], () => load());

  if (err) return <p className="rounded-2xl bg-status-danger/10 px-4 py-3 text-sm text-status-danger">{err}</p>;
  if (!data) return <div className="flex items-center gap-2 py-16 text-sm text-text-muted"><Loader2 size={16} className="animate-spin" /> Getting your dashboard ready…</div>;
  const choices = data.profile?.aspirations || [];
  const meta = data.profile?.aspirantMeta || {};

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-[1.6fr_0.9fr]">
        <PinnedBoard pinned={data.pinned} first={first} houses={data.houses} />
        <div className="flex flex-col rounded-[1.6rem] bg-lemon p-6 text-midnight">
          <div className="flex items-center justify-between">
            <span className="eyebrow text-midnight/60">Your choices</span>
            <Link to="/dashboard/choices" className="inline-flex items-center gap-1 rounded-full bg-midnight px-2.5 py-1 text-[11px] font-semibold text-lemon"><Settings2 size={11} /> Edit</Link>
          </div>
          <div className="mt-4 space-y-3">
            {choices.map((c) => (
              <div key={c.rank} className="rounded-2xl bg-white/55 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-midnight/55">{c.rank === 1 ? "First choice" : "Second choice"}</p>
                <p className="mt-0.5 font-display text-[1.15rem] leading-snug">{institutionTitle(c.institution)}</p>
                {c.course && <p className="text-sm text-midnight/70">{c.course}</p>}
              </div>
            ))}
            {choices.length < 2 && (
              <Link to="/dashboard/choices" className="block rounded-2xl border border-dashed border-midnight/30 px-4 py-3 text-sm font-medium text-midnight/70 hover:border-midnight">+ Add a second choice</Link>
            )}
          </div>
          {(meta.utmeScore != null || meta.utmeYear) && (
            <p className="mt-auto pt-4 text-sm text-midnight/70">UTME {meta.utmeYear || ""}{meta.utmeScore != null ? ` · score ${meta.utmeScore}` : ""}</p>
          )}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center gap-3"><p className="eyebrow text-text-muted">Your Aspirant Houses</p><span className="h-px flex-1 bg-border-subtle" /></div>
        <div className="grid gap-3 sm:grid-cols-2">
          {data.houses.map((h) => (
            <Link key={h.id} to={`/dashboard/house/${h.id}`} className="group flex items-center gap-4 rounded-[1.4rem] border border-border-subtle bg-bg-panel p-4 transition hover:border-accent">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-midnight text-lemon"><Building2 size={20} /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-text-primary">{h.name}</span>
                <span className="mt-0.5 flex items-center gap-3 text-xs text-text-muted">
                  <span className="inline-flex items-center gap-1"><Users size={12} /> {h.memberCount}</span>
                  <span className="inline-flex items-center gap-1"><MessageCircle size={12} /> {h.threadCount}</span>
                  <span>{h.choiceRank === 1 ? "1st choice" : "2nd choice"}</span>
                </span>
              </span>
              {h.unread > 0 && <span className="rounded-full bg-lemon px-2 py-0.5 text-[11px] font-bold text-midnight">{h.unread} new</span>}
              <ArrowRight size={16} className="text-text-muted transition group-hover:translate-x-1 group-hover:text-accent" />
            </Link>
          ))}
          {data.houses.length === 0 && (
            <Link to="/dashboard/choices" className="flex items-center gap-3 rounded-[1.4rem] border border-dashed border-border-strong p-5 text-sm text-text-secondary"><Compass size={18} /> Choose institutions to join their houses</Link>
          )}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center gap-3">
          <p className="eyebrow text-text-muted">News for aspirants</p><span className="h-px flex-1 bg-border-subtle" />
          <Link to="/news" className="text-xs font-semibold text-accent">All news</Link>
        </div>
        {!news && <p className="text-sm text-text-muted">Loading…</p>}
        {news && news.length === 0 && (
          <Link to="/news" className="flex items-center gap-3 rounded-[1.4rem] border border-border-subtle bg-bg-panel p-5 text-sm text-text-secondary hover:border-accent"><Newspaper size={18} className="text-accent" /> Follow Admissions and Exams on Academicall News to get stories here first.</Link>
        )}
        <div className="grid gap-3 md:grid-cols-3">
          {(news || []).slice(0, 3).map((p) => (
            <Link key={p.id} to={`/news/${p.slug}`} className="group overflow-hidden rounded-[1.4rem] border border-border-subtle bg-bg-panel transition hover:border-accent">
              {p.coverUrl ? <img src={p.coverUrl} alt="" loading="lazy" className="aspect-[16/9] w-full object-cover" /> : <div className="aspect-[16/9] w-full bg-violet-soft" />}
              <div className="p-4">
                <p className="text-[11px] font-semibold text-accent">{p.reason || p.category}</p>
                <p className="mt-1 line-clamp-2 font-display text-[1.05rem] leading-snug text-text-primary">{p.title}</p>
                <p className="mt-2 text-xs text-text-muted">{timeAgo(p.publishedAt)}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

/** Pinned house posts as a slow carousel; a friendly welcome when nothing is pinned yet. */
function PinnedBoard({ pinned, first, houses }) {
  const [i, setI] = useState(0);
  const hold = useRef(false);
  const n = pinned.length;
  useEffect(() => {
    if (n < 2) return undefined;
    const t = setInterval(() => { if (!hold.current) setI((x) => (x + 1) % n); }, 8000);
    return () => clearInterval(t);
  }, [n]);
  useEffect(() => { if (i >= n) setI(0); }, [i, n]);

  if (!n) {
    return (
      <div className="relative overflow-hidden rounded-[1.6rem] bg-midnight p-7 text-white sm:p-10">
        <img src="/images/campus/hero-campus.webp" alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-r from-midnight via-midnight/85 to-midnight/30" />
        <div className="relative">
          <p className="eyebrow text-aqua">Aspirant</p>
          <h1 className="mt-4 font-display text-[2.3rem] font-[350] leading-[1.02] tracking-[-0.035em] sm:text-[3rem]">Welcome, <span className="serif-i text-lemon">{first}.</span></h1>
          <p className="mt-4 max-w-md text-[0.98rem] leading-relaxed text-white/65">When your House Leaders pin screening dates, cut-off marks or tips, they show up right here.</p>
          {houses[0] && <Link to={`/dashboard/house/${houses[0].id}`} className="mt-7 inline-flex items-center gap-2 rounded-full bg-lemon px-5 py-3 text-sm font-semibold text-midnight">Open {houses[0].name} <ArrowRight size={15} /></Link>}
        </div>
      </div>
    );
  }
  const t = pinned[Math.min(i, n - 1)];
  return (
    <div className="relative overflow-hidden rounded-[1.6rem] bg-midnight text-white" onMouseEnter={() => { hold.current = true; }} onMouseLeave={() => { hold.current = false; }}>
      {t.imageUrl && <img key={t.id} src={t.imageUrl} alt="" aria-hidden className="board-fade absolute inset-0 h-full w-full object-cover opacity-35" />}
      <div className="absolute inset-0 bg-gradient-to-r from-midnight via-midnight/90 to-midnight/40" />
      <Link key={t.id} to={`/dashboard/house/${t.houseId}/t/${t.id}`} className="board-fade relative block p-7 sm:p-9">
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span className="acx-chip is-lemon"><Pin size={11} /> Pinned</span>
          <span className="text-white/60">{t.house?.name} · {timeAgo(t.pinnedAt || t.createdAt)}</span>
        </div>
        <h2 className="mt-5 font-display text-[1.9rem] font-[380] leading-[1.08] tracking-[-0.02em] sm:text-[2.4rem]">{t.title}</h2>
        <p className="mt-3 line-clamp-3 max-w-xl text-[0.98rem] leading-relaxed text-white/70">{plainText(t.body)}</p>
        <div className="mt-6 flex items-center gap-2.5 text-sm text-white/75">
          <Avatar person={t.author} size={28} /> <span>{t.author?.name} · House Leader</span>
          <span className="ml-auto inline-flex items-center gap-1 font-semibold text-lemon">Read <ArrowRight size={15} /></span>
        </div>
      </Link>
      {n > 1 && (
        <div className="absolute bottom-4 right-5 flex items-center gap-2">
          <button type="button" onClick={() => setI((x) => (x - 1 + n) % n)} className="rounded-full bg-white/10 p-1.5 hover:bg-white/20" aria-label="Previous"><ChevronLeft size={14} /></button>
          <span className="flex gap-1.5">{pinned.map((p, k) => <span key={p.id} className={`h-1.5 rounded-full transition-all ${k === i ? "w-5 bg-lemon" : "w-1.5 bg-white/35"}`} />)}</span>
          <button type="button" onClick={() => setI((x) => (x + 1) % n)} className="rounded-full bg-white/10 p-1.5 hover:bg-white/20" aria-label="Next"><ChevronRight size={14} /></button>
        </div>
      )}
    </div>
  );
}
