import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { homePathFor, nextOnboardingPath } from "../lib/roles";
import {
  GraduationCap,
  BookOpen,
  Timer,
  ArrowRight,
  CheckCircle2,
  Eye,
  Menu,
  X,
  Users,
  Shield,
  Megaphone,
  Flame,
  Calendar,
  Star,
} from "lucide-react";

export default function Landing() {
  const { user, profile, loading, profileReady } = useAuth();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const signedIn = !loading && !!user && profileReady;
  const pendingPath = signedIn ? nextOnboardingPath(profile) : null;
  const appHome = signedIn ? homePathFor(profile) : "/login";
  const ctaPrimary = signedIn ? appHome : "/signup";
  const ctaPrimaryLabel = signedIn ? "Open dashboard" : "Get started free";

  useEffect(() => {
    if (pendingPath) navigate(pendingPath, { replace: true });
  }, [pendingPath, navigate]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (pendingPath) return null;

  return (
    <div className="min-h-screen bg-[#f9f9ff] text-[#0B192C] antialiased selection:bg-[#dae2ff] selection:text-[#001847]">
      {/* ========== HEADER ========== */}
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
          scrolled
            ? "border-b border-[#c5c6cd]/40 bg-white/90 shadow-sm backdrop-blur-md"
            : "bg-white/80 backdrop-blur-md"
        }`}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-5 sm:h-20 sm:px-8 lg:px-12">
          <div className="flex items-center gap-10">
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0B192C] text-white shadow-sm transition group-hover:bg-[#0054cd]">
                <GraduationCap size={20} strokeWidth={2.2} />
              </div>
              <span className="text-xl font-bold tracking-tight text-[#0B192C]">
                Academicall
              </span>
            </Link>

            <nav className="hidden items-center gap-8 md:flex">
              <a href="#features" className="text-sm font-semibold text-[#475569] transition hover:text-[#0054cd]">
                Features
              </a>
              <a href="#pricing" className="text-sm font-semibold text-[#475569] transition hover:text-[#0054cd]">
                Pricing
              </a>
              <a href="#stories" className="text-sm font-semibold text-[#475569] transition hover:text-[#0054cd]">
                Stories
              </a>
            </nav>
          </div>

          <div className="hidden items-center gap-4 md:flex">
            {!signedIn && (
              <Link
                to="/login"
                className="px-3 py-2 text-sm font-semibold text-[#475569] transition hover:text-[#0B192C]"
              >
                Sign in
              </Link>
            )}
            <Link
              to={ctaPrimary}
              className="inline-flex h-10 items-center justify-center rounded-xl bg-[#0054cd] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0040a1]"
            >
              {ctaPrimaryLabel}
            </Link>
          </div>

          <button
            type="button"
            className="rounded-lg p-2 text-[#0B192C] md:hidden"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Menu"
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {menuOpen && (
          <div className="border-t border-[#c5c6cd]/30 bg-white px-5 py-4 md:hidden">
            <div className="flex flex-col gap-3">
              <a href="#features" onClick={() => setMenuOpen(false)} className="text-sm font-medium">
                Features
              </a>
              <a href="#pricing" onClick={() => setMenuOpen(false)} className="text-sm font-medium">
                Pricing
              </a>
              <a href="#stories" onClick={() => setMenuOpen(false)} className="text-sm font-medium">
                Stories
              </a>
              <Link
                to={ctaPrimary}
                onClick={() => setMenuOpen(false)}
                className="mt-1 rounded-xl bg-[#0054cd] px-4 py-2.5 text-center text-sm font-semibold text-white"
              >
                {ctaPrimaryLabel}
              </Link>
            </div>
          </div>
        )}
      </header>

      <main className="pt-16 sm:pt-20">
        {/* ========== HERO ========== */}
        <section className="relative overflow-hidden bg-gradient-to-b from-white via-[#f9f9ff] to-[#f0f3ff] px-5 py-14 sm:px-8 sm:py-20 lg:px-12 lg:py-24">
          {/* subtle dots */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage: "radial-gradient(#0054cd 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />
          <div className="pointer-events-none absolute left-1/2 top-10 h-[320px] w-[700px] -translate-x-1/2 rounded-full bg-[#dae2ff]/50 blur-[130px]" />

          <div className="relative mx-auto max-w-6xl">
            <div className="mb-12 grid items-center gap-10 lg:grid-cols-12 lg:gap-10">
              {/* Left copy */}
              <div className="flex flex-col items-center text-center lg:col-span-7 lg:items-start lg:text-left">
                <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#c5c6cd]/40 bg-white px-3.5 py-1.5 shadow-sm">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                  <span className="text-xs font-semibold tracking-wide text-[#0B192C]">
                    Built for Nigerian campus life
                  </span>
                </div>

                <h1 className="mb-5 max-w-xl text-4xl font-normal leading-tight tracking-tight text-[#0B192C] sm:text-5xl lg:text-[58px] lg:leading-[66px]">
                  Elevate your academic{" "}
                  <span className="italic font-medium text-[#0054cd]">journey</span>
                </h1>

                <p className="mb-8 max-w-xl text-base leading-relaxed text-[#475569] sm:text-lg">
                  Reading Hub, timed practice, department feeds, and class schedules — one place for
                  focus, retention, and real campus workflow.
                </p>

                <div className="mb-5 flex flex-wrap items-center justify-center gap-4 lg:justify-start">
                  <Link
                    to={ctaPrimary}
                    className="inline-flex items-center gap-2.5 rounded-xl bg-[#0054cd] px-7 py-3.5 text-sm font-semibold text-white shadow-md transition hover:bg-[#0040a1] group"
                  >
                    {signedIn ? "Open dashboard" : "Join students on Academicall"}
                    <ArrowRight size={18} className="transition group-hover:translate-x-1" />
                  </Link>
                  <a
                    href="#features"
                    className="inline-flex items-center gap-2 rounded-xl border border-[#c5c6cd]/40 bg-white px-6 py-3.5 text-sm font-semibold text-[#0B192C] shadow-sm transition hover:bg-[#f0f3ff]"
                  >
                    <Eye size={18} className="text-[#0054cd]" />
                    See how it works
                  </a>
                </div>

                <div className="inline-flex items-center gap-2 rounded-full border border-[#c5c6cd]/30 bg-white/80 px-4 py-1 text-xs font-semibold text-[#475569]">
                  For students · Course reps · Staff
                </div>
              </div>

              {/* Right photo card */}
              <div className="relative w-full lg:col-span-5">
                <div className="relative overflow-hidden rounded-3xl border-2 border-white shadow-2xl">
                  <img
                    src="https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=900&q=80"
                    alt="Nigerian university students collaborating"
                    className="h-[360px] w-full object-cover transition duration-500 hover:scale-105 sm:h-[420px]"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0B192C]/80 via-transparent to-transparent" />

                  <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/90 px-3 py-1.5 shadow-md backdrop-blur-md">
                    <GraduationCap size={16} className="text-[#0054cd]" />
                    <span className="text-[11px] font-bold tracking-wide text-[#0B192C]">
                      Over 45+ Campuses
                    </span>
                  </div>

                  <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between gap-3 rounded-2xl border border-white/20 bg-white/90 p-3.5 shadow-lg backdrop-blur-md">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                        <Users size={18} />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-[#0B192C]">Real Study Groups</div>
                        <div className="text-[11px] text-[#475569]">
                          Department chats & past question drills
                        </div>
                      </div>
                    </div>
                    <span className="shrink-0 rounded-lg bg-[#dae2ff]/60 px-2 py-1 text-xs font-bold text-[#0054cd]">
                      UNILAG · OAU · UI
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* ========== PRODUCT MOCKUP ========== */}
            <div className="mx-auto w-full max-w-5xl rounded-3xl border border-[#c5c6cd]/40 bg-white p-4 shadow-xl sm:p-7">
              {/* Course Rep banner */}
              <div className="mb-6 flex flex-col items-start justify-between gap-3 rounded-2xl border border-amber-200/80 bg-amber-50 p-3.5 sm:flex-row sm:items-center">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white">
                    <Megaphone size={16} />
                  </span>
                  <div>
                    <span className="mr-2 rounded bg-amber-200/60 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-amber-800">
                      Course Rep Announcement
                    </span>
                    <span className="text-sm font-semibold text-amber-950">
                      “Class moved to ETF Hall 10am”
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-end text-xs font-medium text-amber-800 sm:self-auto">
                  <Calendar size={14} />
                  15m ago • FOS Hall 1
                </div>
              </div>

              <div className="grid gap-5 lg:grid-cols-12">
                {/* Courses */}
                <div className="flex flex-col gap-3 lg:col-span-4">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#475569]">
                      Registered Courses
                    </span>
                    <span className="text-xs font-semibold text-[#0054cd]">First Semester</span>
                  </div>

                  {[
                    {
                      code: "GST 101",
                      title: "Use of English & Study Skills",
                      badge: "Material Ready",
                      badgeCls: "bg-emerald-100 text-emerald-700",
                      meta: "4 Handouts · 12 Practice sets",
                    },
                    {
                      code: "CHM 211",
                      title: "Basic Organic Chemistry I",
                      badge: "Test Tomorrow",
                      badgeCls: "bg-[#dae2ff] text-[#0054cd]",
                      meta: "6 Handouts · 3 CBT Simulators",
                    },
                    {
                      code: "MTH 101",
                      title: "Elementary Mathematics I (Calculus)",
                      badge: "Past Questions",
                      badgeCls: "bg-slate-200 text-slate-700",
                      meta: "2018–2024 Solved",
                    },
                  ].map((c) => (
                    <div
                      key={c.code}
                      className="rounded-2xl border border-[#c5c6cd]/30 bg-[#f0f3ff] p-3.5 transition hover:border-[#0054cd]/50"
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-sm font-bold text-[#0B192C]">{c.code}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${c.badgeCls}`}>
                          {c.badge}
                        </span>
                      </div>
                      <div className="text-xs font-medium text-[#475569]">{c.title}</div>
                      <div className="mt-2.5 text-[11px] text-[#75777d]">{c.meta}</div>
                    </div>
                  ))}
                </div>

                {/* CBT Simulator */}
                <div className="flex flex-col justify-between rounded-2xl border border-[#c5c6cd]/40 bg-[#f9f9ff] p-4 shadow-sm lg:col-span-5">
                  <div>
                    <div className="mb-3 flex items-center justify-between border-b border-[#c5c6cd]/20 pb-3">
                      <div className="flex items-center gap-2">
                        <Timer size={18} className="text-[#0054cd]" />
                        <span className="text-xs font-semibold text-[#0B192C]">
                          CBT Exam Mode · MTH 101
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 rounded-lg bg-red-100 px-2.5 py-1 font-mono text-xs font-bold text-red-700">
                        <span className="h-2 w-2 animate-ping rounded-full bg-red-600" />
                        14:32 remaining
                      </div>
                    </div>

                    <div className="mb-3">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-[#75777d]">
                        Question 24 of 50
                      </span>
                      <p className="mt-1 text-sm font-semibold text-[#0B192C]">
                        Evaluate lim<sub>x→0</sub> (sin(3x) / x) as applied in differential calculus:
                      </p>
                    </div>

                    <div className="mb-4 space-y-2">
                      <div className="flex items-center gap-3 rounded-xl border border-[#c5c6cd]/30 bg-white p-2.5 text-xs">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full border border-[#c5c6cd] text-[11px] font-bold">
                          A
                        </span>
                        0
                      </div>
                      <div className="flex items-center gap-3 rounded-xl border-2 border-[#0054cd] bg-[#0054cd]/5 p-2.5 text-xs font-medium text-[#0B192C]">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0054cd] text-[11px] font-bold text-white">
                          B
                        </span>
                        3 (Correct selection)
                      </div>
                      <div className="flex items-center gap-3 rounded-xl border border-[#c5c6cd]/30 bg-white p-2.5 text-xs">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full border border-[#c5c6cd] text-[11px] font-bold">
                          C
                        </span>
                        ∞
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-[#c5c6cd]/20 pt-3 text-xs">
                    <span className="font-medium text-[#475569]">Auto-saving answers...</span>
                    <span className="flex items-center gap-1 font-bold text-[#0054cd]">
                      Next Question <ArrowRight size={14} />
                    </span>
                  </div>
                </div>

                {/* Streak + Schedule */}
                <div className="flex flex-col gap-3 lg:col-span-3">
                  <div className="flex flex-col justify-between rounded-2xl bg-gradient-to-br from-[#0B192C] to-slate-900 p-4 text-white">
                    <div>
                      <div className="mb-3 flex items-center justify-between">
                        <Flame size={24} className="text-amber-400" />
                        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-bold text-amber-300">
                          12 Days Active
                        </span>
                      </div>
                      <div className="text-2xl font-bold">Study consistency</div>
                      <div className="mt-1 text-xs text-slate-300">Practice · Read · Show up</div>
                    </div>
                    <div className="mt-4 border-t border-white/10 pt-3">
                      <div className="mb-1 flex justify-between text-[11px] text-slate-300">
                        <span>Weekly Target</span>
                        <span className="font-semibold text-white">88% done</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/20">
                        <div className="h-full rounded-full bg-[#dae2ff]" style={{ width: "88%" }} />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[#c5c6cd]/30 bg-[#f0f3ff] p-3.5">
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-xs font-bold text-[#0B192C]">Today’s Schedule</span>
                      <span className="rounded bg-[#dae2ff] px-1.5 py-0.5 text-[10px] font-bold text-[#0B192C]">
                        2 classes
                      </span>
                    </div>
                    <div className="space-y-1 text-xs text-[#475569]">
                      <div className="flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        10:00 AM — CHM 211 (ETF Hall)
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                        02:00 PM — GST 101 CBT Drill
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========== FEATURES ========== */}
        <section id="features" className="bg-white px-5 py-16 sm:px-8 sm:py-20 lg:px-12">
          <div className="mx-auto max-w-7xl">
            <div className="mb-14 max-w-3xl text-left">
              <div className="mb-3 inline-flex items-center gap-2 rounded bg-[#dae2ff] px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#0B192C]">
                Study consistency — Practice · Read · Show up
              </div>
              <h2 className="text-3xl font-normal tracking-tight text-[#0B192C] sm:text-4xl lg:text-5xl">
                Tools built for mastery
              </h2>
              <p className="mt-4 text-base leading-relaxed text-[#475569] sm:text-lg">
                Digest materials, practice under time pressure, and stay connected to your department
                — without juggling five apps.
              </p>
            </div>

            <div className="grid gap-8 lg:grid-cols-2">
              {/* Reading Hub */}
              <div className="flex flex-col justify-between rounded-3xl border border-[#c5c6cd]/30 bg-[#f9f9ff] p-8 transition hover:shadow-lg sm:p-10">
                <div>
                  <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#dae2ff] text-[#0054cd] shadow-sm">
                    <BookOpen size={24} />
                  </div>
                  <h3 className="mb-3 text-2xl font-semibold text-[#0B192C] sm:text-3xl">
                    Reading Hub
                  </h3>
                  <p className="mb-6 leading-relaxed text-[#475569]">
                    Course PDFs and materials by faculty and level. Open, highlight your path through
                    the term, and keep everything within reach.
                  </p>
                  <div className="mb-8 flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e7eeff] px-3 py-1 text-xs font-semibold text-[#0B192C]">
                      Organised by course
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e7eeff] px-3 py-1 text-xs font-semibold text-[#0B192C]">
                      Distraction-light reading
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl border border-[#c5c6cd]/40 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-[#c5c6cd]/20 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="rounded-lg bg-[#0054cd]/10 px-2.5 py-1 text-xs font-bold text-[#0054cd]">
                        Faculty of Science
                      </span>
                      <span className="text-slate-300">/</span>
                      <span className="rounded-lg bg-[#e7eeff] px-2.5 py-1 text-xs font-semibold">
                        200 Level
                      </span>
                    </div>
                    <span className="text-xs text-[#75777d]">Page 14 of 78</span>
                  </div>
                  <div className="rounded-xl border border-[#c5c6cd]/20 bg-[#f0f3ff] p-4">
                    <div className="mb-1 text-xs font-bold text-[#0B192C]">
                      Module 3: Reaction Mechanisms in Aliphatic Compounds
                    </div>
                    <p className="line-clamp-3 text-xs leading-relaxed text-[#475569]">
                      Electrophilic addition occurs readily across the carbon-carbon double bond.
                      Nucleophiles donate electron pairs to the formed carbocation intermediate...
                    </p>
                    <div className="mt-3 inline-flex items-center gap-2 rounded bg-amber-100/90 px-2.5 py-1 text-[11px] font-medium text-amber-900">
                      Highlighted: Essential test concept for CHM 211 midterm
                    </div>
                  </div>
                </div>
              </div>

              {/* Practice & CBT */}
              <div className="flex flex-col justify-between rounded-3xl border border-[#c5c6cd]/30 bg-[#f9f9ff] p-8 transition hover:shadow-lg sm:p-10">
                <div>
                  <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e7eeff] text-[#0054cd] shadow-sm">
                    <Timer size={24} />
                  </div>
                  <h3 className="mb-3 text-2xl font-semibold text-[#0B192C] sm:text-3xl">
                    Practice & CBT
                  </h3>
                  <p className="mb-6 leading-relaxed text-[#475569]">
                    Timed sets that feel like the real exam. Spot weak areas early and revise with
                    intent — not last-minute panic.
                  </p>
                  <div className="mb-8 flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e7eeff] px-3 py-1 text-xs font-semibold text-[#0B192C]">
                      Timed simulations
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e7eeff] px-3 py-1 text-xs font-semibold text-[#0B192C]">
                      Clear feedback after each set
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl border border-[#c5c6cd]/40 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center justify-between border-b border-[#c5c6cd]/20 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      <span className="text-xs font-bold text-[#0B192C]">GST 101 Drill Set</span>
                    </div>
                    <div className="rounded border border-red-200 bg-red-50 px-2.5 py-0.5 font-mono text-xs font-bold text-red-600">
                      ⏱ 00:08:45
                    </div>
                  </div>
                  <div className="mb-3 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl bg-[#f0f3ff] p-2">
                      <div className="text-[10px] font-semibold uppercase text-[#475569]">Answered</div>
                      <div className="text-sm font-bold text-[#0B192C]">38/40</div>
                    </div>
                    <div className="rounded-xl bg-emerald-50 p-2 text-emerald-900">
                      <div className="text-[10px] font-semibold uppercase">Accuracy</div>
                      <div className="text-sm font-bold">92%</div>
                    </div>
                    <div className="rounded-xl bg-blue-50 p-2 text-blue-900">
                      <div className="text-[10px] font-semibold uppercase">Weak Area</div>
                      <div className="text-sm font-bold">Lexis</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs text-emerald-900">
                    <CheckCircle2 size={18} className="shrink-0 text-emerald-600" />
                    <div>
                      <span className="font-bold">Option C selected correctly.</span>
                      <div className="mt-0.5 text-[11px] text-emerald-800">
                        Comprehensive explanation & textbook citation generated instantly.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========== CAMPUS TEAMS ========== */}
        <section className="bg-[#f0f3ff] px-5 py-16 sm:px-8 sm:py-20 lg:px-12">
          <div className="mx-auto max-w-7xl">
            <div className="mb-14 max-w-3xl">
              <span className="text-xs font-bold uppercase tracking-wider text-[#0054cd]">
                Campus coordination made simple
              </span>
              <h2 className="mt-2 text-3xl font-normal tracking-tight text-[#0B192C] sm:text-4xl lg:text-5xl">
                Built for campus teams
              </h2>
              <p className="mt-4 text-base leading-relaxed text-[#475569] sm:text-lg">
                Course reps post schedules and materials. Staff run feeds and support. Students get
                one calm place to show up for class and exams.
              </p>
            </div>

            <div className="mb-12 grid gap-8 md:grid-cols-2">
              <div className="rounded-3xl border border-[#c5c6cd]/30 bg-white p-8 shadow-sm transition hover:shadow-md">
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#dae2ff] text-[#0054cd]">
                  <Users size={24} />
                </div>
                <h3 className="mb-3 text-2xl font-semibold text-[#0B192C]">
                  Department feeds & classes
                </h3>
                <p className="mb-6 leading-relaxed text-[#475569]">
                  Announcements and schedules where your classmates already are.
                </p>
                <div className="flex flex-col gap-2.5 rounded-2xl border border-[#c5c6cd]/20 bg-[#f0f3ff] p-4">
                  <div className="flex items-center gap-2.5 text-xs font-semibold text-[#0B192C]">
                    <CheckCircle2 size={16} className="text-[#0054cd]" />
                    Verified Course Rep Posts Only
                  </div>
                  <div className="flex items-center gap-2.5 text-xs text-[#475569]">
                    <Calendar size={16} className="text-[#75777d]" />
                    Timetable syncs directly with student reminders
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-[#c5c6cd]/30 bg-white p-8 shadow-sm transition hover:shadow-md">
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e7eeff] text-[#0054cd]">
                  <Shield size={24} />
                </div>
                <h3 className="mb-3 text-2xl font-semibold text-[#0B192C]">Staff HQ & roles</h3>
                <p className="mb-6 leading-relaxed text-[#475569]">
                  Admins and agents coordinate without scattering across chats.
                </p>
                <div className="flex flex-col gap-2.5 rounded-2xl border border-[#c5c6cd]/20 bg-[#f0f3ff] p-4">
                  <div className="flex items-center gap-2.5 text-xs font-semibold text-[#0B192C]">
                    <Shield size={16} className="text-[#0054cd]" />
                    Moderation controls and role-based permissions
                  </div>
                  <div className="flex items-center gap-2.5 text-xs text-[#475569]">
                    Official student helpdesk & query resolution
                  </div>
                </div>
              </div>
            </div>

            <Link
              to={ctaPrimary}
              className="inline-flex items-center gap-2 rounded-xl bg-[#0B192C] px-7 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              Create your account
              <ArrowRight size={18} />
            </Link>
          </div>
        </section>

        {/* ========== TESTIMONIALS ========== */}
        <section id="stories" className="bg-[#f9f9ff] px-5 py-16 sm:px-8 sm:py-20 lg:px-12">
          <div className="mx-auto max-w-7xl">
            <div className="mb-14 max-w-2xl">
              <span className="text-xs font-bold uppercase tracking-wider text-[#0054cd]">
                Verified experiences
              </span>
              <h2 className="mt-2 text-3xl font-normal tracking-tight text-[#0B192C] sm:text-4xl lg:text-5xl">
                Voices from campus
              </h2>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {[
                {
                  quote:
                    "The Reading Hub and timed practice changed how I revise. I finally know what I don’t know before the exam.",
                  name: "Esther Enefola",
                  role: "Undergraduate · University of Abuja",
                },
                {
                  quote:
                    "Department posts, class schedules, and materials in one place. Less WhatsApp chaos, more actual studying.",
                  name: "OluwaBright",
                  role: "Student · Campus community",
                },
                {
                  quote:
                    "Pro practice and the timetable keep me consistent. Academicall feels built for how we actually learn here.",
                  name: "Akinwale Taiye",
                  role: "Course mate · Faculty of Science",
                },
              ].map((t) => (
                <div
                  key={t.name}
                  className="flex flex-col justify-between rounded-3xl border border-[#c5c6cd]/30 bg-white p-8 shadow-sm transition hover:shadow-md"
                >
                  <div>
                    <div className="mb-5 flex gap-1 text-amber-500">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} size={16} fill="currentColor" />
                      ))}
                    </div>
                    <blockquote className="mb-6 text-lg italic leading-snug text-[#0B192C]">
                      “{t.quote}”
                    </blockquote>
                  </div>
                  <div className="border-t border-[#c5c6cd]/20 pt-4">
                    <div className="text-sm font-bold text-[#0B192C]">{t.name}</div>
                    <div className="text-xs text-[#475569]">{t.role}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ========== PRICING ========== */}
        <section id="pricing" className="bg-[#f0f3ff] px-5 py-16 sm:px-8 sm:py-20 lg:px-12">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto mb-16 max-w-3xl text-center">
              <h2 className="text-3xl font-normal tracking-tight text-[#0B192C] sm:text-4xl lg:text-5xl">
                Simple, transparent pricing
              </h2>
              <p className="mt-3 text-base text-[#475569] sm:text-lg">
                Start free. Upgrade when you want full Pro tools.
              </p>
            </div>

            <div className="mx-auto grid max-w-6xl items-stretch gap-8 lg:grid-cols-3">
              {/* Free */}
              <div className="flex flex-col justify-between rounded-3xl border border-[#c5c6cd]/40 bg-white p-8 shadow-sm">
                <div>
                  <div className="mb-4">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#75777d]">
                      Tier 1
                    </span>
                    <h3 className="mt-1 text-2xl font-bold text-[#0B192C]">Free</h3>
                    <p className="text-xs font-medium text-[#475569]">Core campus tools</p>
                  </div>
                  <div className="mb-6 border-b border-[#c5c6cd]/20 pb-6">
                    <span className="text-4xl font-bold text-[#0B192C]">₦0</span>
                    <span className="text-sm font-semibold text-[#475569]">/mo</span>
                  </div>
                  <ul className="mb-8 space-y-3">
                    {["Department feed", "Class schedules", "Limited practice"].map((item) => (
                      <li key={item} className="flex items-center gap-2.5 text-sm font-medium">
                        <CheckCircle2 size={16} className="text-[#0054cd]" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <Link
                  to="/signup"
                  className="flex h-11 w-full items-center justify-center rounded-xl bg-[#e7eeff] text-sm font-semibold text-[#0B192C] transition hover:bg-[#d8e3fb]"
                >
                  Sign up free
                </Link>
              </div>

              {/* Student Pro */}
              <div className="relative flex flex-col justify-between rounded-3xl border-2 border-[#0054cd] bg-[#0B192C] p-8 text-white shadow-xl lg:-translate-y-2">
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-[#0054cd] px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-white shadow-md">
                  Most popular
                </div>
                <div>
                  <div className="mb-4 mt-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#dae2ff]">
                      Recommended
                    </span>
                    <h3 className="mt-1 text-2xl font-bold">Student Pro</h3>
                    <p className="text-xs font-medium text-slate-300">Full mastery toolkit</p>
                  </div>
                  <div className="mb-2">
                    <span className="text-4xl font-bold">₦1,500</span>
                    <span className="text-sm font-semibold text-slate-300">/mo</span>
                  </div>
                  <div className="mb-6 border-b border-white/15 pb-6 text-xs font-semibold text-[#dae2ff]">
                    Also weekly ₦500 · annual ₦4,000
                  </div>
                  <ul className="mb-8 space-y-3">
                    {["Full Reading Hub", "Unlimited practice", "Anonymous comments (Pro)"].map(
                      (item) => (
                        <li key={item} className="flex items-center gap-2.5 text-sm font-medium">
                          <CheckCircle2 size={16} className="text-[#dae2ff]" />
                          {item}
                        </li>
                      )
                    )}
                  </ul>
                </div>
                <Link
                  to="/signup"
                  className="flex h-11 w-full items-center justify-center rounded-xl bg-[#0054cd] text-sm font-bold text-white shadow-md transition hover:bg-blue-600"
                >
                  Go Pro
                </Link>
              </div>

              {/* Campus / staff */}
              <div className="flex flex-col justify-between rounded-3xl border border-[#c5c6cd]/40 bg-white p-8 shadow-sm">
                <div>
                  <div className="mb-4">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#75777d]">
                      Institutions
                    </span>
                    <h3 className="mt-1 text-2xl font-bold text-[#0B192C]">Campus / staff</h3>
                    <p className="text-xs font-medium text-[#475569]">Reps, agents & admin</p>
                  </div>
                  <div className="mb-6 border-b border-[#c5c6cd]/20 pb-6">
                    <span className="text-4xl font-bold text-[#0B192C]">Included</span>
                  </div>
                  <ul className="mb-8 space-y-3">
                    {["Course rep tools", "Staff HQ", "Feeds & moderation"].map((item) => (
                      <li key={item} className="flex items-center gap-2.5 text-sm font-medium">
                        <CheckCircle2 size={16} className="text-[#0054cd]" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <Link
                  to="/login"
                  className="flex h-11 w-full items-center justify-center rounded-xl bg-[#e7eeff] text-sm font-semibold text-[#0B192C] transition hover:bg-[#d8e3fb]"
                >
                  Staff sign in
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ========== FOOTER ========== */}
      <footer className="border-t border-[#c5c6cd]/30 bg-white">
        <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 lg:px-12">
          <div className="grid gap-10 border-b border-[#c5c6cd]/20 pb-12 md:grid-cols-2 lg:grid-cols-5">
            <div className="lg:col-span-2 lg:pr-6">
              <div className="mb-4 flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0B192C] text-white">
                  <GraduationCap size={18} />
                </div>
                <span className="text-xl font-bold text-[#0B192C]">Academicall</span>
              </div>
              <p className="mb-6 max-w-sm text-sm leading-relaxed text-[#475569]">
                Elevating campus learning with Reading Hub, practice, and department tools.
              </p>
              <div className="inline-flex items-center gap-2 rounded-full bg-[#f0f3ff] px-3 py-1.5 text-xs font-semibold text-[#475569]">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Active across Nigerian campuses
              </div>
            </div>

            <div>
              <h4 className="mb-4 text-xs font-bold uppercase tracking-wider text-[#0B192C]">
                Product
              </h4>
              <ul className="space-y-2.5">
                <li>
                  <a href="#features" className="text-sm text-[#475569] transition hover:text-[#0054cd]">
                    Features
                  </a>
                </li>
                <li>
                  <a href="#pricing" className="text-sm text-[#475569] transition hover:text-[#0054cd]">
                    Pricing
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="mb-4 text-xs font-bold uppercase tracking-wider text-[#0B192C]">
                Account
              </h4>
              <ul className="space-y-2.5">
                <li>
                  <Link to="/login" className="text-sm text-[#475569] transition hover:text-[#0054cd]">
                    Sign in
                  </Link>
                </li>
                <li>
                  <Link to="/signup" className="text-sm text-[#475569] transition hover:text-[#0054cd]">
                    Sign up
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="mb-4 text-xs font-bold uppercase tracking-wider text-[#0B192C]">
                Legal
              </h4>
              <ul className="space-y-2.5">
                <li>
                  <a href="#" className="text-sm text-[#475569] transition hover:text-[#0054cd]">
                    Privacy
                  </a>
                </li>
                <li>
                  <a href="#" className="text-sm text-[#475569] transition hover:text-[#0054cd]">
                    Terms
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="flex flex-col items-center justify-between gap-4 pt-8 text-xs text-[#475569] sm:flex-row">
            <span>© 2026 Academicall</span>
            <span>Focus, retention, and real campus workflow.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}