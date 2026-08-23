import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { homePathFor } from "../lib/roles";
import {
  GraduationCap,
  BookOpen,
  Brain,
  ArrowRight,
  CheckCircle2,
  PlayCircle,
  TrendingUp,
  Shield,
  Menu,
  X,
  Quote,
} from "lucide-react";

const HERO_IMG =
  "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1600&q=80";

const TESTIMONIALS = [
  {
    name: "Esther Enefola",
    role: "Undergraduate · University of Abuja",
    quote:
      "The Reading Hub and timed practice changed how I revise. I finally know what I don’t know before the exam.",
  },
  {
    name: "OluwaBright",
    role: "Student · Campus community",
    quote:
      "Department posts, class schedules, and materials in one place. Less WhatsApp chaos, more actual studying.",
  },
  {
    name: "Akinwale Taiye",
    role: "Course mate · Faculty of Science",
    quote:
      "Pro practice and the timetable keep me consistent. Academicall feels built for how we actually learn here.",
  },
];

export default function Landing() {
  const { user, profile, loading, profileReady } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // Only treat as signed-in once auth is settled — prevents "Open dashboard" after logout
  const signedIn = !loading && !!user && profileReady;
  const appHome = signedIn ? homePathFor(profile) : "/login";
  const ctaPrimary = signedIn ? appHome : "/signup";
  const ctaPrimaryLabel = signedIn ? "Open dashboard" : "Get started free";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f7faf6] text-[#181c1a] antialiased">
      {/* Nav */}
      <nav
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
          scrolled
            ? "border-b border-white/30 bg-white/80 shadow-sm backdrop-blur-md"
            : "bg-white/70 backdrop-blur-md"
        }`}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:h-20 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#005239] text-white shadow-md">
              <GraduationCap size={18} strokeWidth={2.4} />
            </span>
            <span className="text-lg font-extrabold tracking-tight text-[#005239]">
              Academicall
            </span>
          </Link>

          <div className="hidden items-center gap-8 md:flex">
            <a
              href="#features"
              className="text-sm font-semibold text-[#005239] hover:opacity-80"
            >
              Features
            </a>
            <a
              href="#pricing"
              className="text-sm font-medium text-[#3f4943] hover:text-[#005239]"
            >
              Pricing
            </a>
            <a
              href="#stories"
              className="text-sm font-medium text-[#3f4943] hover:text-[#005239]"
            >
              Stories
            </a>
          </div>

          <div className="hidden items-center gap-3 md:flex">
            {!signedIn && (
              <Link
                to="/login"
                className="text-sm font-semibold text-[#005239] hover:underline"
              >
                Sign in
              </Link>
            )}
            <Link
              to={ctaPrimary}
              className="rounded-full bg-[#fb923c] px-5 py-2.5 text-sm font-bold tracking-wide text-white shadow-md shadow-orange-500/20 transition hover:opacity-90"
            >
              {ctaPrimaryLabel}
            </Link>
          </div>

          <button
            type="button"
            className="rounded-lg p-2 text-[#005239] md:hidden"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Menu"
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {menuOpen && (
          <div className="border-t border-black/5 bg-white px-4 py-4 md:hidden">
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
                className="rounded-full bg-[#fb923c] px-4 py-2.5 text-center text-sm font-bold text-white"
              >
                {ctaPrimaryLabel}
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden pb-20 pt-28 sm:pt-32">
        <div className="pointer-events-none absolute inset-0 z-0">
          <div className="absolute left-1/4 top-0 h-[480px] w-[480px] rounded-full bg-[#a6f2cf]/25 blur-[100px]" />
          <div className="absolute bottom-0 right-1/4 h-[360px] w-[360px] rounded-full bg-[#c3e8ff]/35 blur-[100px]" />
        </div>

        <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-2">
          <div className="flex max-w-xl flex-col gap-5">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/40 bg-white/60 px-3.5 py-1.5 backdrop-blur-sm">
              <span className="h-2 w-2 animate-pulse rounded-full bg-[#8ad6b3]" />
              <span className="text-xs font-bold tracking-wide text-[#005239]">
                Built for Nigerian campus life
              </span>
            </div>

            <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-[#181c1a] sm:text-4xl md:text-5xl lg:text-[3.5rem] lg:leading-[1.1]">
              Elevate your{" "}
              <span className="text-[#005239]">academic journey</span>
            </h1>

            <p className="text-base leading-relaxed text-[#3f4943] sm:text-lg">
              Reading Hub, timed practice, department feeds, and class schedules —
              one place for focus, retention, and real campus workflow.
            </p>

            <div className="mt-2 flex flex-col gap-3 sm:flex-row">
              <Link
                to={ctaPrimary}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#fb923c] px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-orange-500/25 transition hover:-translate-y-0.5 hover:opacity-95"
              >
                {signedIn ? "Open dashboard" : "Join students on Academicall"}
                <ArrowRight size={16} />
              </Link>
              <a
                href="#features"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/50 bg-white/70 px-7 py-3.5 text-sm font-bold text-[#005239] backdrop-blur-sm transition hover:bg-white"
              >
                <PlayCircle size={18} />
                See how it works
              </a>
            </div>

            <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-[#6f7973]">
              For students · Course reps · Staff
            </p>
          </div>

          <div className="relative mt-4 h-[320px] overflow-hidden rounded-2xl shadow-2xl shadow-[#00668a]/10 sm:h-[420px] lg:mt-0 lg:h-[520px]">
            <img
              src={HERO_IMG}
              alt="Students collaborating on campus"
              className="h-full w-full object-cover"
            />
            <div className="absolute bottom-5 left-5 right-5 max-w-xs rounded-xl border border-white/40 bg-white/75 p-4 shadow-lg backdrop-blur-md sm:right-auto">
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#a6f2cf]/40">
                  <TrendingUp size={20} className="text-[#005239]" />
                </div>
                <div>
                  <p className="text-xs font-bold text-[#005239]">Study consistency</p>
                  <p className="text-sm font-semibold text-[#181c1a]">
                    Practice · Read · Show up
                  </p>
                </div>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[#e0e3df]">
                <div className="h-full w-3/4 rounded-full bg-[#005239]" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="bg-[#f1f4f0] py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <h2 className="text-2xl font-bold tracking-tight text-[#181c1a] sm:text-4xl">
              Tools built for mastery
            </h2>
            <p className="mt-3 text-base text-[#3f4943] sm:text-lg">
              Digest materials, practice under time pressure, and stay connected to
              your department — without juggling five apps.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-white/50 bg-white/70 p-7 shadow-sm backdrop-blur-sm transition hover:-translate-y-1 hover:shadow-md">
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-[#c3e8ff] bg-[#c3e8ff]/40">
                <BookOpen size={26} className="text-[#00668a]" />
              </div>
              <h3 className="text-xl font-semibold text-[#181c1a]">Reading Hub</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#3f4943]">
                Course PDFs and materials by faculty and level. Open, highlight your
                path through the term, and keep everything within reach.
              </p>
              <ul className="mt-5 space-y-2 text-sm text-[#181c1a]">
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-[#1b6b4f]" /> Organised by course
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-[#1b6b4f]" /> Distraction-light reading
                </li>
              </ul>
            </div>

            <div className="rounded-2xl border border-white/50 bg-white/70 p-7 shadow-sm backdrop-blur-sm transition hover:-translate-y-1 hover:shadow-md">
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-[#a6f2cf] bg-[#a6f2cf]/35">
                <Brain size={26} className="text-[#005239]" />
              </div>
              <h3 className="text-xl font-semibold text-[#181c1a]">Practice & CBT</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#3f4943]">
                Timed sets that feel like the real exam. Spot weak areas early and
                revise with intent — not last-minute panic.
              </p>
              <ul className="mt-5 space-y-2 text-sm text-[#181c1a]">
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-[#1b6b4f]" /> Timed simulations
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-[#1b6b4f]" /> Clear feedback after each set
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Campus / staff band */}
      <section className="relative overflow-hidden bg-[#00668a] py-16 text-[#f7faf6] sm:py-20">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(141,213,254,0.2),transparent_55%)]" />
        <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold tracking-tight sm:text-4xl">
              Built for campus teams
            </h2>
            <p className="mt-4 text-base text-white/80 sm:text-lg">
              Course reps post schedules and materials. Staff run feeds and support.
              Students get one calm place to show up for class and exams.
            </p>
            <div className="mt-8 space-y-5">
              <div className="flex gap-3">
                <TrendingUp className="mt-0.5 shrink-0 text-[#a6f2cf]" size={22} />
                <div>
                  <p className="font-semibold">Department feeds & classes</p>
                  <p className="text-sm text-white/70">
                    Announcements and schedules where your classmates already are.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <Shield className="mt-0.5 shrink-0 text-[#a6f2cf]" size={22} />
                <div>
                  <p className="font-semibold">Staff HQ & roles</p>
                  <p className="text-sm text-white/70">
                    Admins and agents coordinate without scattering across chats.
                  </p>
                </div>
              </div>
            </div>
            <Link
              to={signedIn ? appHome : "/signup"}
              className="mt-8 inline-flex rounded-full bg-[#f7faf6] px-6 py-3 text-sm font-bold text-[#00668a] transition hover:bg-white"
            >
              {signedIn ? "Go to app" : "Create your account"}
            </Link>
          </div>
          <div className="flex h-56 items-end justify-between gap-2 rounded-2xl border border-white/20 bg-white/10 p-6 backdrop-blur-sm sm:h-72">
            {[30, 50, 40, 70, 90].map((h, i) => (
              <div
                key={i}
                className="w-1/6 rounded-t-md bg-[#a6f2cf]/50"
                style={{ height: `${h}%`, opacity: 0.45 + i * 0.12 }}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="stories" className="bg-[#f7faf6] py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="mb-10 text-center text-2xl font-bold tracking-tight sm:text-4xl">
            Voices from campus
          </h2>
          <div className="grid gap-6 md:grid-cols-3">
            {TESTIMONIALS.map((t) => (
              <div
                key={t.name}
                className="relative rounded-2xl border border-[#e0e3df] bg-white p-6 shadow-sm"
              >
                <Quote
                  size={28}
                  className="absolute right-5 top-5 text-[#e0e3df]"
                  strokeWidth={1.5}
                />
                <p className="relative z-10 text-base italic leading-relaxed text-[#3f4943]">
                  “{t.quote}”
                </p>
                <div className="mt-6">
                  <p className="text-sm font-bold text-[#181c1a]">{t.name}</p>
                  <p className="text-xs text-[#6f7973]">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing — aligned with product (₦) */}
      <section id="pricing" className="bg-[#f1f4f0] py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-12 text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-4xl">
              Simple, transparent pricing
            </h2>
            <p className="mt-2 text-[#3f4943]">
              Start free. Upgrade when you want full Pro tools.
            </p>
          </div>

          <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-3">
            <div className="flex flex-col rounded-2xl border border-white/60 bg-white/60 p-7 backdrop-blur-sm">
              <h3 className="text-lg font-semibold">Free</h3>
              <p className="mt-1 text-sm text-[#3f4943]">Core campus tools</p>
              <p className="mt-6 text-3xl font-extrabold">
                ₦0<span className="text-base font-normal text-[#6f7973]">/mo</span>
              </p>
              <ul className="mt-6 flex-1 space-y-2 text-sm">
                <li className="flex gap-2">
                  <CheckCircle2 size={16} className="text-[#005239]" /> Department feed
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 size={16} className="text-[#005239]" /> Class schedules
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 size={16} className="text-[#005239]" /> Limited practice
                </li>
              </ul>
              <Link
                to="/signup"
                className="mt-8 block rounded-full border-2 border-[#005239] py-2.5 text-center text-sm font-bold text-[#005239] hover:bg-[#005239]/5"
              >
                Sign up free
              </Link>
            </div>

            <div className="relative flex flex-col rounded-2xl border-2 border-[#00668a] bg-white p-7 shadow-lg md:-translate-y-2">
              <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#00668a] px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                Most popular
              </span>
              <h3 className="text-lg font-semibold text-[#00668a]">Student Pro</h3>
              <p className="mt-1 text-sm text-[#3f4943]">Full mastery toolkit</p>
              <p className="mt-6 text-3xl font-extrabold">
                ₦1,500
                <span className="text-base font-normal text-[#6f7973]">/mo</span>
              </p>
              <p className="text-xs text-[#6f7973]">
                Also weekly ₦500 · annual ₦4,000
              </p>
              <ul className="mt-6 flex-1 space-y-2 text-sm">
                <li className="flex gap-2">
                  <CheckCircle2 size={16} className="text-[#00668a]" /> Full Reading Hub
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 size={16} className="text-[#00668a]" /> Unlimited practice
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 size={16} className="text-[#00668a]" /> Anonymous comments (Pro)
                </li>
              </ul>
              <Link
                to={signedIn ? "/dashboard/upgrade" : "/signup"}
                className="mt-8 block rounded-full bg-[#fb923c] py-2.5 text-center text-sm font-bold text-white shadow-md hover:opacity-90"
              >
                Go Pro
              </Link>
            </div>

            <div className="flex flex-col rounded-2xl border border-white/60 bg-white/60 p-7 backdrop-blur-sm">
              <h3 className="text-lg font-semibold">Campus / staff</h3>
              <p className="mt-1 text-sm text-[#3f4943]">Reps, agents & admin</p>
              <p className="mt-6 text-3xl font-extrabold">Included</p>
              <ul className="mt-6 flex-1 space-y-2 text-sm">
                <li className="flex gap-2">
                  <CheckCircle2 size={16} className="text-[#005239]" /> Course rep tools
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 size={16} className="text-[#005239]" /> Staff HQ
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 size={16} className="text-[#005239]" /> Feeds & moderation
                </li>
              </ul>
              <Link
                to="/login"
                className="mt-8 block rounded-full border-2 border-[#005239] py-2.5 text-center text-sm font-bold text-[#005239] hover:bg-[#005239]/5"
              >
                Staff sign in
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#2d312f] py-14 text-[#f7faf6]">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:grid-cols-2 sm:px-6 md:grid-cols-4">
          <div className="md:col-span-1">
            <p className="text-lg font-bold">Academicall</p>
            <p className="mt-2 max-w-xs text-sm text-white/70">
              Elevating campus learning with Reading Hub, practice, and department tools.
            </p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-white/50">
              Product
            </p>
            <ul className="mt-3 space-y-2 text-sm text-white/70">
              <li>
                <a href="#features" className="hover:text-white">
                  Features
                </a>
              </li>
              <li>
                <a href="#pricing" className="hover:text-white">
                  Pricing
                </a>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-white/50">
              Account
            </p>
            <ul className="mt-3 space-y-2 text-sm text-white/70">
              <li>
                <Link to="/login" className="hover:text-white">
                  Sign in
                </Link>
              </li>
              <li>
                <Link to="/signup" className="hover:text-white">
                  Sign up
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-white/50">
              Legal
            </p>
            <ul className="mt-3 space-y-2 text-sm text-white/70">
              <li>
                <span className="opacity-80">Privacy · Terms</span>
              </li>
            </ul>
            <p className="mt-6 text-xs text-white/40">
              © {new Date().getFullYear()} Academicall
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
