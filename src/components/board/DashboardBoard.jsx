import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Building2, ChevronLeft, ChevronRight, ClipboardCheck, Library } from "lucide-react";
import { boardApi } from "../../lib/aspirantApi";

const THEMES = {
  midnight: { bg: "bg-midnight", text: "text-white", sub: "text-white/70", accent: "text-lemon", btn: "bg-lemon text-midnight", shade: "from-midnight via-midnight/85 to-midnight/25" },
  violet: { bg: "bg-violet", text: "text-white", sub: "text-white/75", accent: "text-lemon", btn: "bg-white text-violet", shade: "from-violet via-violet/85 to-violet/25" },
  lemon: { bg: "bg-lemon", text: "text-midnight", sub: "text-midnight/70", accent: "text-violet", btn: "bg-midnight text-lemon", shade: "from-lemon via-lemon/85 to-lemon/20" },
  aqua: { bg: "bg-aqua", text: "text-midnight", sub: "text-midnight/70", accent: "text-violet", btn: "bg-midnight text-aqua", shade: "from-aqua via-aqua/85 to-aqua/20" },
};

export function SlideCta({ slide, className }) {
  if (!slide.ctaUrl || !slide.ctaLabel) return null;
  const inner = <>{slide.ctaLabel} <ArrowRight size={15} /></>;
  return slide.ctaUrl.startsWith("/")
    ? <Link to={slide.ctaUrl} className={className}>{inner}</Link>
    : <a href={slide.ctaUrl} target="_blank" rel="noreferrer" className={className}>{inner}</a>;
}

/** One slide, used by the dashboard and by the editor's live preview. */
export function Slide({ slide, background, greeting }) {
  if (greeting) return greeting;
  if (slide.kind === "image") {
    const img = <img src={slide.imageUrl} alt={slide.title || ""} className="absolute inset-0 h-full w-full object-cover" />;
    if (!slide.ctaUrl) return img;
    return slide.ctaUrl.startsWith("/")
      ? <Link to={slide.ctaUrl} aria-label={slide.title || "Open"} className="absolute inset-0">{img}</Link>
      : <a href={slide.ctaUrl} target="_blank" rel="noreferrer" aria-label={slide.title || "Open"} className="absolute inset-0">{img}</a>;
  }
  const t = THEMES[slide.theme] || THEMES.midnight;
  const bg = slide.imageUrl || background;
  return (
    <div className={`absolute inset-0 ${t.bg}`}>
      {bg && <img src={bg} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover object-[80%_center] opacity-45" />}
      <div className={`absolute inset-0 bg-gradient-to-r ${t.shade}`} />
      <div className={`relative flex h-full flex-col justify-end p-7 sm:p-10 ${t.text}`}>
        {slide.title && <h2 className="max-w-xl font-display text-[2rem] font-[360] leading-[1.04] tracking-[-0.03em] sm:text-[2.6rem]">{slide.title}</h2>}
        {slide.body && <p className={`mt-3 max-w-lg text-[0.98rem] leading-relaxed ${t.sub}`}>{slide.body}</p>}
        <SlideCta slide={slide} className={`mt-6 inline-flex w-fit items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold ${t.btn}`} />
      </div>
    </div>
  );
}

/**
 * The big board at the top of the student dashboard. Only admins and agents with the
 * "Dashboard board" permission choose what it shows: text messages over a background,
 * or full-bleed designs with no text. With nothing curated it greets the student.
 */
export default function DashboardBoard({ profile, firstName, institution, meta, nextLine }) {
  const navigate = useNavigate();
  const [board, setBoard] = useState(null);
  const [i, setI] = useState(0);
  const hold = useRef(false);
  const touch = useRef(null);

  useEffect(() => {
    let alive = true;
    boardApi.get().then((b) => alive && setBoard(b)).catch(() => alive && setBoard({ settings: {}, slides: [] }));
    return () => { alive = false; };
  }, [profile?.id]);

  const settings = board?.settings || {};
  const slides = board?.slides || [];
  const showGreeting = settings.showGreeting !== false || slides.length === 0;
  const total = slides.length + (showGreeting ? 1 : 0);
  const interval = Math.max(3, Number(settings.intervalSec) || 7) * 1000;

  useEffect(() => {
    if (total < 2 || settings.rotate === false) return undefined;
    const id = setInterval(() => { if (!hold.current && document.visibilityState === "visible") setI((x) => (x + 1) % total); }, interval);
    return () => clearInterval(id);
  }, [total, interval, settings.rotate]);
  useEffect(() => { if (i >= total) setI(0); }, [i, total]);

  const greeting = (
    <div className="absolute inset-0 bg-midnight">
      <img src={settings.backgroundUrl || "/images/campus/library-wide.webp"} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover object-[80%_center] opacity-35" />
      <div className="absolute inset-0 bg-gradient-to-r from-midnight via-midnight/90 to-midnight/30" />
      <div className="relative flex h-full flex-col justify-center p-7 text-white sm:p-10">
        <p className="inline-flex w-fit items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/85"><Building2 size={13} aria-hidden="true" />{institution}</p>
        <p className="eyebrow mt-3 text-aqua">{meta || "Complete your profile for a personal feed"}</p>
        <h1 className="mt-4 font-display text-[2.3rem] font-[350] leading-[1.02] tracking-[-0.035em] sm:text-[3rem]">Welcome back, <span className="serif-i text-lemon">{firstName}.</span></h1>
        <p className="mt-3 max-w-md text-[0.96rem] leading-relaxed text-white/65">{nextLine}</p>
        <div className="mt-7 flex flex-wrap gap-2.5">
          <button type="button" onClick={() => navigate("/dashboard/reading-hub")} className="inline-flex items-center gap-2 rounded-full bg-lemon px-5 py-3 text-sm font-semibold text-midnight transition hover:brightness-105"><Library size={15} /> Continue reading</button>
          <button type="button" onClick={() => navigate("/dashboard/practice")} className="inline-flex items-center gap-2 rounded-full border border-white/20 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/10"><ClipboardCheck size={15} /> Practice CBT</button>
        </div>
      </div>
    </div>
  );

  const items = [...(showGreeting ? [{ id: "greeting", greeting: true }] : []), ...slides];
  const current = items[Math.min(i, items.length - 1)];

  return (
    <div
      className="board relative min-h-[19rem] overflow-hidden rounded-[1.6rem] bg-midnight ring-1 ring-transparent dark:ring-white/10 sm:min-h-[22rem]"
      onMouseEnter={() => { hold.current = true; }}
      onMouseLeave={() => { hold.current = false; }}
      onTouchStart={(e) => { touch.current = e.touches[0].clientX; hold.current = true; }}
      onTouchEnd={(e) => {
        const dx = e.changedTouches[0].clientX - (touch.current ?? e.changedTouches[0].clientX);
        if (Math.abs(dx) > 40 && total > 1) setI((x) => (x + (dx < 0 ? 1 : -1) + total) % total);
        hold.current = false;
      }}
      aria-roledescription="carousel"
    >
      {!board ? (
        <div className="absolute inset-0 animate-pulse bg-midnight-2" />
      ) : (
        <div key={current?.id} className="board-fade absolute inset-0">
          {current?.greeting ? greeting : <Slide slide={current} background={settings.backgroundUrl} />}
        </div>
      )}
      {total > 1 && (
        <div className="absolute bottom-4 right-4 z-10 flex items-center gap-2 rounded-full bg-midnight/45 px-2 py-1 backdrop-blur-sm">
          <button type="button" onClick={() => setI((x) => (x - 1 + total) % total)} className="rounded-full p-1 text-white/80 hover:text-white" aria-label="Previous slide"><ChevronLeft size={14} /></button>
          <span className="flex gap-1.5">{items.map((s, k) => <button key={s.id} type="button" onClick={() => setI(k)} aria-label={`Slide ${k + 1}`} className={`h-1.5 rounded-full transition-all ${k === i ? "w-5 bg-lemon" : "w-1.5 bg-white/45"}`} />)}</span>
          <button type="button" onClick={() => setI((x) => (x + 1) % total)} className="rounded-full p-1 text-white/80 hover:text-white" aria-label="Next slide"><ChevronRight size={14} /></button>
        </div>
      )}
    </div>
  );
}
