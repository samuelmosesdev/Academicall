import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { homePathFor, nextOnboardingPath } from "../lib/roles";
import { ArrowRight, ArrowUpRight, Menu, X, Mail, Phone, MapPin, Plus, Minus } from "lucide-react";

/*
  Academicall landing — "Ink & Lemon"
  Calm, spacious, editorial. Palette: Violet #454ADE · Aqua #44FFD1 · Midnight #0F0326 · Lemon #F8F32B
  Always light: the landing is the shop window, independent of the app theme.
*/

const IMG = {
  hero: "/images/campus/hero-campus.webp",
  group: "/images/campus/study-group.webp",
  rep: "/images/campus/course-rep.webp",
  library: "/images/campus/student-library.webp",
  phone: "/images/campus/student-phone.webp",
};

const FAQ = [
  ["Is Academicall free for students?", "Yes. Reading materials, your department feed, class schedules and practice tests are free. Pro adds the full timetable and unlimited AI quizzes."],
  ["Who becomes a course rep?", "Any student can apply from their profile. An agent reviews the application and the admin approves it, so only real reps can post to a department."],
  ["Does it work on my phone?", "Yes. Academicall works in any mobile browser. The native Android package is not available for download from this site yet."],
  ["Which schools can use it?", "We started with the University of Abuja. Other Nigerian universities can be added department by department."],
];

export default function Landing() {
  const { user, profile, loading, profileReady } = useAuth();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState(0);

  const signedIn = !loading && !!user && profileReady;
  const pendingPath = signedIn ? nextOnboardingPath(profile) : null;
  const appHome = signedIn ? homePathFor(profile) : "/login";
  const ctaPrimary = signedIn ? appHome : "/signup";
  const ctaLabel = signedIn ? "Open dashboard" : "Get started";

  useEffect(() => {
    if (pendingPath) navigate(pendingPath, { replace: true });
  }, [pendingPath, navigate]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (pendingPath) return null;

  const nav = [["Product", "#product"], ["For course reps", "#reps"], ["Questions", "#faq"], ["App", "#app"]];

  return (
    <div className="theme-light-only min-h-screen bg-paper text-midnight antialiased">
      {/* ───────── Header ───────── */}
      <header className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${scrolled ? "border-b border-midnight/[0.07] bg-paper/90 backdrop-blur-md" : ""}`}>
        <div className="mx-auto grid h-[72px] max-w-[1200px] grid-cols-[1fr_auto_1fr] items-center px-6 sm:px-10">
          <Link to="/" aria-label="Academicall home" className="justify-self-start">
            <img src="/brand/logo-horizontal.png" alt="Academicall" className="h-[26px] w-auto" />
          </Link>
          <nav className="hidden items-center gap-9 md:flex">
            {nav.map(([l, h]) => (
              <a key={l} href={h} className="text-[0.88rem] text-midnight/65 transition hover:text-midnight">{l}</a>
            ))}
          </nav>
          <div className="hidden items-center justify-self-end gap-5 md:flex">
            {!signedIn && <Link to="/login" className="text-[0.88rem] font-medium text-midnight/80 hover:text-midnight">Sign in</Link>}
            <Link to={ctaPrimary} className="rounded-full bg-midnight px-5 py-2.5 text-[0.86rem] font-medium text-white transition hover:bg-midnight-2">
              {ctaLabel}
            </Link>
          </div>
          <button type="button" aria-label="Menu" onClick={() => setMenuOpen((v) => !v)} className="col-start-3 justify-self-end rounded-full p-2 md:hidden">
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
        {menuOpen && (
          <div className="mx-4 mb-3 rounded-3xl border border-midnight/[0.07] bg-white p-3 shadow-xl md:hidden">
            {nav.map(([l, h]) => (
              <a key={l} href={h} onClick={() => setMenuOpen(false)} className="block rounded-2xl px-4 py-3 text-[0.95rem] hover:bg-paper">{l}</a>
            ))}
            <div className="mt-2 grid grid-cols-2 gap-2">
              {!signedIn && <Link to="/login" className="rounded-full border border-midnight/15 py-3 text-center text-sm font-medium">Sign in</Link>}
              <Link to={ctaPrimary} className={`rounded-full bg-midnight py-3 text-center text-sm font-medium text-white ${signedIn ? "col-span-2" : ""}`}>{ctaLabel}</Link>
            </div>
          </div>
        )}
      </header>

      <main>
        {/* ───────── Hero ───────── */}
        <section className="px-6 pb-20 pt-36 sm:px-10 sm:pt-44">
          <div className="mx-auto max-w-[920px] text-center">
            <a href="#product" className="rise inline-flex items-center gap-2.5 rounded-full border border-midnight/10 bg-white py-1.5 pl-2 pr-4 text-[0.8rem] text-midnight/70 transition hover:border-midnight/25">
              <span className="live-dot ml-2" />
              Now live<span className="hidden sm:inline">&nbsp;for University of Abuja students</span><span className="sm:hidden">&nbsp;at UniAbuja</span> <ArrowRight size={13} />
            </a>
            <h1 className="rise rise-1 mt-8 font-display text-[2.9rem] font-[350] leading-[1.02] tracking-[-0.035em] sm:text-[4.6rem] lg:text-[5.4rem]">
              Your whole semester,
              <br />
              <span className="serif-i text-violet">calmly</span> in one place.
            </h1>
            <p className="rise rise-2 mx-auto mt-7 max-w-[560px] text-[1.08rem] leading-relaxed text-midnight/65">
              Lecture notes, class changes, practice tests and your course rep's updates — sorted by your department and level.
            </p>
            <div className="rise rise-3 mt-10 flex flex-wrap items-center justify-center gap-3">
              <Link to={ctaPrimary} className="group inline-flex items-center gap-2 rounded-full bg-midnight px-7 py-4 text-[0.95rem] font-medium text-white transition hover:bg-midnight-2">
                {signedIn ? "Open dashboard" : "Create your free account"}
                <ArrowRight size={17} className="transition group-hover:translate-x-0.5" />
              </Link>
              <a href="#product" className="inline-flex items-center gap-2 rounded-full px-6 py-4 text-[0.95rem] font-medium text-midnight/80 transition hover:text-midnight">
                See how it works <ArrowUpRight size={16} />
              </a>
            </div>
          </div>

          {/* Product composition */}
          <div id="product" className="relative mx-auto mt-20 max-w-[1200px] scroll-mt-28 sm:mt-24">
            <div className="photo-frame relative aspect-[4/5] sm:aspect-[16/8.2]">
              <img src={IMG.hero} alt="University students walking together on campus" className="h-full w-full object-cover object-[60%_center]" />
              <div className="absolute inset-0 bg-gradient-to-t from-midnight/55 via-midnight/0 to-transparent" />
              <span className="eyebrow absolute left-4 top-4 rounded-full bg-paper/90 px-3 py-2 text-midnight shadow-sm sm:left-6 sm:top-6">
                Example app preview
              </span>
            </div>

            <div className="relative z-10 mx-auto -mt-28 grid max-w-[1080px] gap-4 px-3 sm:-mt-32 sm:grid-cols-3 sm:px-6">
              {/* Lemon: next class */}
              <div className="float-card bg-lemon p-6">
                <div className="flex items-center justify-between">
                  <span className="eyebrow text-midnight/60">Next class</span>
                  <span className="eyebrow rounded-full bg-midnight px-2 py-1 text-lemon">in 42 min</span>
                </div>
                <p className="mt-6 font-display text-[1.6rem] font-[420] leading-tight">CSC 201</p>
                <p className="text-[0.92rem] text-midnight/70">Data Structures · LT 2 · 10:00</p>
                <div className="ticket-rule mt-5" />
                <p className="mt-3 text-[0.82rem] text-midnight/70">38 classmates going</p>
              </div>
              {/* Midnight: streak */}
              <div className="float-card bg-midnight p-6 text-white">
                <div className="flex items-center justify-between">
                  <span className="eyebrow text-white/50">Reading streak</span>
                  <span className="eyebrow text-aqua">This week</span>
                </div>
                <p className="num mt-5 text-[3.2rem] font-light leading-none">7<span className="text-white/40">/7</span></p>
                <div className="mt-5 flex gap-1.5">
                  {[13, 8, 14, 9, 6, 11, 16].map((v, i) => (
                    <span key={i} className="flex-1 rounded-md bg-aqua" style={{ height: v * 2.4, opacity: 0.35 + v / 26, alignSelf: "flex-end" }} />
                  ))}
                </div>
              </div>
              {/* Aqua: quiz */}
              <div className="float-card bg-aqua-soft p-6">
                <div className="flex items-center justify-between">
                  <span className="eyebrow text-midnight/60">Practice quiz</span>
                  <span className="eyebrow text-aqua-deep">Pages 4–9</span>
                </div>
                <p className="num mt-5 text-[3.2rem] font-light leading-none">87%</p>
                <p className="mt-3 text-[0.9rem] text-midnight/70">13 of 15 right on Trees &amp; Graphs. Two to revisit.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ───────── Statement ───────── */}
        <section className="px-6 py-24 sm:px-10 sm:py-32">
          <p className="mx-auto max-w-[900px] text-center font-display text-[1.9rem] font-[350] leading-[1.25] tracking-[-0.02em] text-midnight sm:text-[2.6rem]">
            No more scrolling through six group chats to find out the CA moved.{" "}
            <span className="text-midnight/40">One quiet place for your department — what to read, where to be, and how ready you are.</span>
          </p>
        </section>

        {/* ───────── Roles ───────── */}
        <section className="mx-auto max-w-[1200px] px-6 pb-28 sm:px-10">
          <div className="flex flex-wrap items-end justify-between gap-6 border-b border-midnight/10 pb-8">
            <h2 className="font-display text-[2.3rem] font-[380] leading-tight tracking-[-0.03em] sm:text-[3rem]">Made for everyone<br />on campus.</h2>
            <p className="max-w-sm text-midnight/60">Four roles, one home. Everyone sees exactly what they need — nothing more.</p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[
              ["01", "Students", "Read, track your progress and test yourself before exams.", "bg-white"],
              ["02", "Course reps", "Schedule classes, share materials and reach the whole level.", "bg-lemon-soft"],
              ["03", "Agents", "Review reports and recommend new course reps.", "bg-aqua-soft"],
              ["04", "Admins", "Approve, moderate and keep the platform healthy.", "bg-violet-soft"],
            ].map(([n, t, d, bg]) => (
              <div key={t} className={`${bg} flex min-h-[15rem] flex-col justify-between rounded-[1.25rem] border border-midnight/[0.06] p-7`}>
                <span className="eyebrow text-midnight/50">Role {n}</span>
                <div>
                  <h3 className="font-display text-[1.7rem] font-[420] tracking-[-0.02em]">{t}</h3>
                  <p className="mt-2 text-[0.94rem] leading-relaxed text-midnight/65">{d}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ───────── Feature: students ───────── */}
        <Feature
          eyebrow="For students"
          title={<>Read it. Track it. <span className="serif-i">Then test yourself.</span></>}
          body="Every material your course rep shares lands in your Reading Hub. Read on any device, keep a daily study streak, and generate a practice quiz from what you just read."
          points={["A Reading Hub for every course", "AI practice quizzes from your materials", "Timed CBT practice before exams"]}
          image={IMG.group}
          alt="Three students studying together with a laptop"
        />

        {/* ───────── Feature: course reps ───────── */}
        <Feature
          id="reps"
          reverse
          eyebrow="For course reps"
          title={<>Reach your whole level in <span className="serif-i">one post,</span> not ten messages.</>}
          body="Schedule a class, move a test or share new slides, and everyone in your department and level sees it at once — with a notification on their phone."
          points={["Schedule lectures, tutorials and tests", "Share materials straight to the Reading Hub", "Approve who joins your class group"]}
          image={IMG.rep}
          alt="A course representative speaking to classmates in a lecture theatre"
        />

        {/* ───────── FAQ ───────── */}
        <section id="faq" className="mx-auto max-w-[1200px] scroll-mt-24 px-6 py-28 sm:px-10">
          <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <span className="eyebrow text-violet">Questions</span>
              <h2 className="mt-4 font-display text-[2.3rem] font-[380] leading-tight tracking-[-0.03em] sm:text-[3rem]">Good to know.</h2>
              <p className="mt-4 max-w-xs text-midnight/60">
                Anything else? Write to <a href="mailto:info@surfwired.com" className="text-midnight underline decoration-lemon decoration-[3px] underline-offset-4">info@surfwired.com</a>
              </p>
            </div>
            <div className="divide-y divide-midnight/10 border-y border-midnight/10">
              {FAQ.map(([q, a], i) => {
                const open = openFaq === i;
                return (
                  <div key={q}>
                    <button type="button" onClick={() => setOpenFaq(open ? -1 : i)} className="flex w-full items-center justify-between gap-6 py-6 text-left" aria-expanded={open}>
                      <span className="text-[1.08rem] font-medium">{q}</span>
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition ${open ? "bg-midnight text-white" : "bg-white text-midnight ring-1 ring-midnight/10"}`}>
                        {open ? <Minus size={15} /> : <Plus size={15} />}
                      </span>
                    </button>
                    {open && <p className="animate-fade -mt-2 max-w-xl pb-6 text-[0.98rem] leading-relaxed text-midnight/65">{a}</p>}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ───────── App band ───────── */}
        <section id="app" className="scroll-mt-24 px-4 pb-24 sm:px-10">
          <div className="mx-auto grid max-w-[1200px] overflow-hidden rounded-[1.25rem] bg-midnight text-white lg:grid-cols-2">
            <div className="flex flex-col justify-center p-9 sm:p-16">
              <span className="eyebrow text-aqua">Phone access</span>
              <h2 className="mt-5 font-display text-[2.4rem] font-[350] leading-[1.08] tracking-[-0.03em] sm:text-[3.2rem]">
                Your semester, <span className="serif-i text-lemon">wherever you are.</span>
              </h2>
              <p className="mt-5 max-w-md text-white/65">Use the mobile-friendly web app to check class updates, reading materials and practice. The native Android package is not published from this site yet.</p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Link to={ctaPrimary} className="inline-flex items-center gap-2 rounded-full border border-white/20 px-6 py-3.5 text-[0.95rem] font-medium transition hover:bg-white/10">
                  {signedIn ? "Open Academicall" : "Get started"} <ArrowUpRight size={16} />
                </Link>
              </div>
            </div>
            <div className="relative min-h-[24rem]">
              <img src={IMG.phone} alt="A student checking his timetable on his phone" className="absolute inset-0 h-full w-full object-cover object-[50%_30%]" />
              <div className="absolute bottom-6 left-6 right-6 rounded-2xl bg-white p-4 text-midnight shadow-2xl sm:left-auto sm:w-72">
                <div className="flex items-center gap-2">
                  <img src="/brand/mark.png" alt="" className="h-6 w-6" />
                  <span className="eyebrow text-midnight/50">Academicall · now</span>
                </div>
                <p className="mt-2 text-[0.92rem] font-medium leading-snug">CSC 201 CA moved to Thursday, 9:00 · LT 1</p>
              </div>
            </div>
          </div>
        </section>

        {/* ───────── Final CTA ───────── */}
        <section className="px-6 pb-32 pt-8 text-center sm:px-10">
          <h2 className="mx-auto max-w-3xl font-display text-[2.6rem] font-[350] leading-[1.05] tracking-[-0.035em] sm:text-[4rem]">
            Start this semester <span className="mark-lemon">organised.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-md text-midnight/60">Free for students. It takes about a minute.</p>
          <Link to={ctaPrimary} className="group mt-10 inline-flex items-center gap-2 rounded-full bg-midnight px-8 py-4 font-medium text-white transition hover:bg-midnight-2">
            {signedIn ? "Open dashboard" : "Create your free account"} <ArrowRight size={18} className="transition group-hover:translate-x-0.5" />
          </Link>
        </section>
      </main>

      {/* ───────── Footer ───────── */}
      <footer className="border-t border-midnight/10">
        <div className="mx-auto grid max-w-[1200px] gap-10 px-6 py-16 sm:px-10 md:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <img src="/brand/logo-horizontal.png" alt="Academicall" className="h-6 w-auto" />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-midnight/55">The academic home for your department. Made in Abuja by Surfwired Technologies.</p>
          </div>
          <ul className="space-y-3 text-sm text-midnight/70">
            <li className="flex items-center gap-2.5"><MapPin size={14} className="text-violet" /> Abuja, Nigeria</li>
            <li className="flex items-center gap-2.5"><Phone size={14} className="text-violet" /><a href="tel:+2348152243717" className="hover:text-midnight">0815 224 3717</a></li>
            <li className="flex items-center gap-2.5"><Mail size={14} className="text-violet" /><a href="mailto:info@surfwired.com" className="hover:text-midnight">info@surfwired.com</a></li>
          </ul>
          <ul className="space-y-3 text-sm text-midnight/70">
            <li><a href="#product" className="hover:text-midnight">Product</a></li>
            <li><a href="#reps" className="hover:text-midnight">For course reps</a></li>
            <li><a href="#app" className="hover:text-midnight">Phone access</a></li>
            <li><Link to="/privacy" className="hover:text-midnight">Privacy</Link></li>
          </ul>
        </div>
        <div className="border-t border-midnight/[0.07] py-6 text-center text-xs text-midnight/45">
          © {new Date().getFullYear()} Surfwired Technologies. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

function Feature({ id, eyebrow, title, body, points, image, alt, reverse }) {
  return (
    <section id={id} className="mx-auto max-w-[1200px] scroll-mt-24 px-6 py-20 sm:px-10 sm:py-24">
      <div className={`grid items-center gap-12 lg:grid-cols-2 lg:gap-24 ${reverse ? "lg:[&>*:first-child]:order-2" : ""}`}>
        <div className="photo-frame aspect-[4/3.4]">
          <img src={image} alt={alt} loading="lazy" className="h-full w-full object-cover" />
        </div>
        <div>
          <span className="eyebrow text-violet">{eyebrow}</span>
          <h2 className="mt-5 font-display text-[2.3rem] font-[380] leading-[1.08] tracking-[-0.03em] sm:text-[3rem]">{title}</h2>
          <p className="mt-6 max-w-lg text-[1.04rem] leading-relaxed text-midnight/65">{body}</p>
          <ul className="mt-9 border-t border-midnight/10">
            {points.map((p, i) => (
              <li key={p} className="flex items-center gap-5 border-b border-midnight/10 py-4 text-[0.98rem]">
                <span className="eyebrow w-6 text-midnight/40">0{i + 1}</span>
                {p}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
