import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { homePathFor, nextOnboardingPath } from "../lib/roles";
import {
  BookOpen,
  Timer,
  ArrowRight,
  CheckCircle2,
  Menu,
  X,
  Users,
  Shield,
  Megaphone,
  Calendar,
  Smartphone,
  Download,
  Building2,
  Mail,
  Phone,
  MapPin,
  Zap,
  ChevronRight,
} from "lucide-react";

/* Brand colors from Academicall Identity Guidelines v1.0
   Deep Blue   #14355E  (primary)
   Bright Blue #3D6FE0  (secondary)
   Accent Lime #D6E64A  (highlights only)
   Ink         #101C30  (text)
   Mist        #F3F6FB  (bg)
*/

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
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (pendingPath) return null;

  return (
    <div className="min-h-screen bg-[#F3F6FB] text-[#101C30] antialiased selection:bg-[#3D6FE0]/20 selection:text-[#14355E]">
      {/* ========== HEADER ========== */}
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
          scrolled
            ? "border-b border-[#14355E]/10 bg-white/95 shadow-sm backdrop-blur-md"
            : "bg-white/80 backdrop-blur-sm"
        }`}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-5 sm:h-[72px] sm:px-8 lg:px-10">
          <div className="flex items-center gap-10">
            <Link to="/" className="flex items-center gap-0 group">
              {/* Horizontal lockup on light bg */}
              <img
                src="/brand/logo-horizontal.png"
                alt="Academicall"
                className="h-8 w-auto object-contain sm:h-9"
              />
            </Link>

            <nav className="hidden items-center gap-8 md:flex">
              {["Features", "How it works", "Download"].map((item) => (
                <a
                  key={item}
                  href={`#${item.toLowerCase().replace(/ /g, "-")}`}
                  className="text-sm font-medium text-[#14355E]/70 transition hover:text-[#14355E]"
                >
                  {item}
                </a>
              ))}
              <Link
                to="/privacy"
                className="text-sm font-medium text-[#14355E]/70 transition hover:text-[#14355E]"
              >
                Privacy
              </Link>
            </nav>
          </div>

          <div className="hidden items-center gap-3 md:flex">
            {!signedIn && (
              <Link
                to="/login"
                className="px-3 py-2 text-sm font-semibold text-[#14355E]/80 transition hover:text-[#14355E]"
              >
                Sign in
              </Link>
            )}
            <Link
              to={ctaPrimary}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-[#3D6FE0] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#14355E]"
            >
              {ctaPrimaryLabel}
            </Link>
          </div>

          <button
            type="button"
            className="rounded-lg p-2 text-[#14355E] md:hidden"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Menu"
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {menuOpen && (
          <div className="border-t border-[#14355E]/10 bg-white px-5 py-4 md:hidden">
            <div className="flex flex-col gap-3">
              <a href="#features" onClick={() => setMenuOpen(false)} className="text-sm font-medium text-[#14355E]">Features</a>
              <a href="#how-it-works" onClick={() => setMenuOpen(false)} className="text-sm font-medium text-[#14355E]">How it works</a>
              <a href="#download" onClick={() => setMenuOpen(false)} className="text-sm font-medium text-[#14355E]">Download</a>
              <Link to="/privacy" onClick={() => setMenuOpen(false)} className="text-sm font-medium text-[#14355E]">Privacy</Link>
              <Link
                to={ctaPrimary}
                onClick={() => setMenuOpen(false)}
                className="mt-1 rounded-lg bg-[#3D6FE0] px-4 py-2.5 text-center text-sm font-semibold text-white"
              >
                {ctaPrimaryLabel}
              </Link>
            </div>
          </div>
        )}
      </header>

      <main className="pt-16 sm:pt-[72px]">
        {/* ========== HERO ========== */}
        <section className="relative overflow-hidden bg-white px-5 pb-16 pt-14 sm:px-8 sm:pb-24 sm:pt-20 lg:px-10 lg:pb-28 lg:pt-24">
          <div className="pointer-events-none absolute -right-32 top-0 h-[420px] w-[420px] rounded-full bg-[#3D6FE0]/08 blur-3xl" />
          <div className="pointer-events-none absolute -left-24 bottom-10 h-[280px] w-[280px] rounded-full bg-[#D6E64A]/15 blur-3xl" />

          <div className="relative mx-auto max-w-7xl">
            <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-10">
              <div className="flex flex-col lg:col-span-6">
                <div className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-[#14355E]/10 bg-[#F3F6FB] px-3.5 py-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#D6E64A] opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-[#D6E64A]" />
                  </span>
                  <span className="text-xs font-semibold tracking-wide text-[#14355E]">
                    Web & Android · Guided academic workflows
                  </span>
                </div>

                <h1 className="mb-5 max-w-xl text-[2.2rem] font-bold leading-[1.15] tracking-tight text-[#101C30] sm:text-5xl lg:text-[3.15rem] lg:leading-[1.1]">
                  Guided academic workflows for modern{" "}
                  <span className="text-[#3D6FE0]">universities.</span>
                </h1>

                <p className="mb-8 max-w-lg text-base leading-relaxed text-[#14355E]/75 sm:text-lg">
                  Academicall brings clarity to university operations — connecting
                  admissions, coursework, and administration inside one guided
                  academic process platform.
                </p>

                <div className="mb-7 flex flex-wrap items-center gap-3">
                  <Link
                    to={ctaPrimary}
                    className="group inline-flex items-center gap-2 rounded-lg bg-[#3D6FE0] px-6 py-3.5 text-sm font-semibold text-white shadow-md shadow-[#3D6FE0]/25 transition hover:bg-[#14355E]"
                  >
                    {signedIn ? "Open dashboard" : "Get started"}
                    <ArrowRight size={17} className="transition group-hover:translate-x-0.5" />
                  </Link>
                  <a
                    href="#download"
                    className="inline-flex items-center gap-2 rounded-lg border border-[#14355E]/15 bg-white px-5 py-3.5 text-sm font-semibold text-[#14355E] shadow-sm transition hover:border-[#14355E]/25 hover:bg-[#F3F6FB]"
                  >
                    <Download size={17} className="text-[#3D6FE0]" />
                    Get the Android app
                  </a>
                </div>

                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium text-[#14355E]/60">
                  <span className="inline-flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-[#3D6FE0]" />
                    Clear steps
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-[#3D6FE0]" />
                    Guided process
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-[#3D6FE0]" />
                    Elevated experience
                  </span>
                </div>
              </div>

              {/* Right visual */}
              <div className="relative lg:col-span-6">
                <div className="relative mx-auto max-w-md lg:max-w-none">
                  <div className="relative overflow-hidden rounded-2xl border border-[#14355E]/10 bg-[#F3F6FB] shadow-xl shadow-[#14355E]/10">
                    {/*
                      HERO IMAGE
                      Path:  public/images/hero-campus.jpg
                      Size:  1200 × 900 px
                    */}
                    <img
                      src="https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1200&q=80"
                      alt="University students and campus"
                      className="h-[300px] w-full object-cover sm:h-[360px] lg:h-[400px]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#14355E]/80 via-[#14355E]/20 to-transparent" />

                    <div className="absolute bottom-0 left-0 right-0 p-5">
                      <div className="rounded-xl border border-white/20 bg-white/95 p-4 shadow-lg backdrop-blur-sm">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#3D6FE0]/10 text-[#3D6FE0]">
                            <Users size={20} />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-[#101C30]">
                              Admissions · Coursework · Records
                            </p>
                            <p className="text-xs text-[#14355E]/65">
                              Guided step-by-step workflows
                            </p>
                          </div>
                          <div className="hidden items-center gap-1.5 rounded-md bg-[#D6E64A]/30 px-2.5 py-1 text-[11px] font-bold text-[#14355E] sm:flex">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#D6E64A]" />
                            Live
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Floating accent badges */}
                  <div className="absolute -left-2 top-10 hidden rounded-xl border border-[#14355E]/10 bg-white px-3.5 py-2.5 shadow-lg sm:block lg:-left-6">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#D6E64A] text-[#101C30]">
                        <Zap size={16} strokeWidth={2.5} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[#101C30]">Clear next step</p>
                        <p className="text-[11px] text-[#14355E]/65">Always guided</p>
                      </div>
                    </div>
                  </div>

                  <div className="absolute -right-2 bottom-28 hidden rounded-xl border border-[#14355E]/10 bg-white px-3.5 py-2.5 shadow-lg sm:block lg:-right-4">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#3D6FE0] text-white">
                        <BookOpen size={16} strokeWidth={2.5} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[#101C30]">One process</p>
                        <p className="text-[11px] text-[#14355E]/65">Start to outcome</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========== TRUST STRIP ========== */}
        <section className="border-y border-[#14355E]/08 bg-[#F3F6FB] px-5 py-5 sm:px-8 lg:px-10">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-10 gap-y-3 text-sm font-medium text-[#14355E]/70">
            <span className="inline-flex items-center gap-2">
              <Building2 size={15} className="text-[#3D6FE0]" />
              Surfwired Technologies · Abuja
            </span>
            <span className="hidden h-4 w-px bg-[#14355E]/15 sm:block" />
            <span className="inline-flex items-center gap-2">
              <Smartphone size={15} className="text-[#3D6FE0]" />
              Web + Android APK ready
            </span>
            <span className="hidden h-4 w-px bg-[#14355E]/15 sm:block" />
            <span className="inline-flex items-center gap-2">
              <Shield size={15} className="text-[#3D6FE0]" />
              Privacy & data protection first
            </span>
          </div>
        </section>

        {/* ========== FEATURES + FLOATING IMAGE ========== */}
        <section id="features" className="relative bg-white px-5 py-16 sm:px-8 sm:py-20 lg:px-10 lg:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="mb-12 max-w-2xl">
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-[#3D6FE0]">
                Everything you need
              </p>
              <h2 className="text-3xl font-bold tracking-tight text-[#101C30] sm:text-4xl">
                Clear. Guided. Elevated.
              </h2>
              <p className="mt-3 text-base leading-relaxed text-[#14355E]/75 sm:text-lg">
                One platform for admissions, coursework, and records — designed so every
                step is easy to understand and complete.
              </p>
            </div>

            <div className="relative grid gap-10 lg:grid-cols-12 lg:gap-12">
              <div className="grid gap-5 sm:grid-cols-2 lg:col-span-7">
                {[
                  {
                    icon: BookOpen,
                    title: "Admissions",
                    desc: "Guided step-by-step from application to enrollment — nothing hidden, nothing overexplained.",
                    color: "bg-[#3D6FE0]/10 text-[#3D6FE0]",
                  },
                  {
                    icon: Timer,
                    title: "Coursework",
                    desc: "Reading materials, timed practice, and assignments organised by faculty and level.",
                    color: "bg-[#D6E64A]/25 text-[#14355E]",
                  },
                  {
                    icon: Megaphone,
                    title: "Department feeds",
                    desc: "Course-rep announcements, class moves and updates in one clean stream.",
                    color: "bg-[#3D6FE0]/10 text-[#3D6FE0]",
                  },
                  {
                    icon: Calendar,
                    title: "Records & schedules",
                    desc: "Timetables, academic records and milestones — always oriented on the next step.",
                    color: "bg-[#D6E64A]/25 text-[#14355E]",
                  },
                ].map((f) => (
                  <div
                    key={f.title}
                    className="rounded-2xl border border-[#14355E]/08 bg-[#F3F6FB] p-6 transition hover:border-[#3D6FE0]/25 hover:bg-white hover:shadow-md"
                  >
                    <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl ${f.color}`}>
                      <f.icon size={22} />
                    </div>
                    <h3 className="mb-2 text-lg font-semibold text-[#101C30]">{f.title}</h3>
                    <p className="text-sm leading-relaxed text-[#14355E]/70">{f.desc}</p>
                  </div>
                ))}
              </div>

              {/* ========== FLOATING RECTANGLE IMAGE BOX ========== */}
              {/*
                Save image as: public/images/floating-preview.png
                Size: 480 × 720 px (portrait 2:3)
              */}
              <div className="relative lg:col-span-5">
                <div className="sticky top-28">
                  <div
                    className="relative mx-auto w-full max-w-[300px] overflow-hidden rounded-2xl border border-[#14355E]/10 bg-[#F3F6FB] shadow-xl shadow-[#14355E]/10 lg:max-w-none"
                    style={{ animation: "floatY 7s ease-in-out infinite" }}
                  >
                    <div className="flex aspect-[2/3] flex-col items-center justify-center gap-4 p-8 text-center">
                      <img
                        src="/brand/mark-full-color.png"
                        alt="Academicall mark"
                        className="h-16 w-16 object-contain"
                      />
                      <div>
                       <img
                      src="images/floating-preview.png"
                      alt="Academicall app preview"
                      className="h-full w-full object-cover"
                      />
                      </div>
                    </div>
                    {/*
                    Replace the div above with:
                    <img
                      src="/images/floating-preview.png"
                      alt="Academicall app preview"
                      className="h-full w-full object-cover"
                    />
                    */}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========== HOW IT WORKS ========== */}
        <section id="how-it-works" className="border-t border-[#14355E]/08 bg-[#F3F6FB] px-5 py-16 sm:px-8 sm:py-20 lg:px-10">
          <div className="mx-auto max-w-7xl">
            <div className="mb-12 text-center">
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-[#3D6FE0]">
                Simple onboarding
              </p>
              <h2 className="text-3xl font-bold tracking-tight text-[#101C30] sm:text-4xl">
                Up and running in minutes
              </h2>
            </div>

            <div className="grid gap-6 sm:grid-cols-3">
              {[
                {
                  step: "01",
                  title: "Create your account",
                  desc: "Sign up with email. Accept the privacy policy once and you're in.",
                },
                {
                  step: "02",
                  title: "Pick campus & courses",
                  desc: "Select faculty, level and courses so materials and feeds match you.",
                },
                {
                  step: "03",
                  title: "Study on web or Android",
                  desc: "Use the browser or install the APK. Your progress stays in sync.",
                },
              ].map((s, i) => (
                <div
                  key={s.step}
                  className="relative rounded-2xl border border-[#14355E]/08 bg-white p-7 shadow-sm"
                >
                  <span className="mb-4 inline-flex h-9 min-w-[2.25rem] items-center justify-center rounded-lg bg-[#3D6FE0] px-2.5 text-xs font-bold text-white">
                    {s.step}
                  </span>
                  <h3 className="mb-2 text-lg font-semibold text-[#101C30]">{s.title}</h3>
                  <p className="text-sm leading-relaxed text-[#14355E]/70">{s.desc}</p>
                  {i < 2 && (
                    <ChevronRight
                      size={18}
                      className="absolute right-3 top-1/2 hidden -translate-y-1/2 text-[#14355E]/20 sm:block lg:right-[-12px] lg:z-10"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ========== DOWNLOAD / APK ========== */}
        <section id="download" className="bg-white px-5 py-16 sm:px-8 sm:py-20 lg:px-10">
          <div className="mx-auto max-w-7xl">
            <div className="relative overflow-hidden rounded-3xl bg-[#14355E] px-8 py-12 shadow-xl sm:px-12 sm:py-14">
              <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[#3D6FE0]/30 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-12 -left-12 h-40 w-40 rounded-full bg-[#D6E64A]/20 blur-3xl" />

              <div className="relative grid items-center gap-10 lg:grid-cols-2">
                <div>
                  <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-white backdrop-blur-sm">
                    <Smartphone size={14} />
                    Android APK available now
                  </div>
                  <h2 className="mb-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                    Take Academicall with you
                  </h2>
                  <p className="mb-7 max-w-md text-base leading-relaxed text-white/80">
                    Install the official Android app from Surfwired Technologies.
                    Same account, same progress — optimised for phones and offline-friendly use.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <a
                      href="#download"
                      className="inline-flex items-center gap-2 rounded-lg bg-[#D6E64A] px-5 py-3 text-sm font-semibold text-[#101C30] shadow-md transition hover:bg-[#E2EE80]"
                    >
                      <Download size={18} />
                      Download APK
                    </a>
                    <Link
                      to={ctaPrimary}
                      className="inline-flex items-center gap-2 rounded-lg border border-white/30 bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
                    >
                      Continue on web
                      <ArrowRight size={16} />
                    </Link>
                  </div>
                </div>
                <div className="flex justify-center lg:justify-end">
                  <div className="flex h-40 w-40 items-center justify-center rounded-3xl border border-white/15 bg-white/10 backdrop-blur-sm">
                    {/* Reversed / white mark on dark */}
                    <img
                      src="/brand/mark-full-color.png"
                      alt="Academicall"
                      className="h-24 w-24 object-contain"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========== FINAL CTA ========== */}
        <section className="border-t border-[#14355E]/08 bg-[#F3F6FB] px-5 py-14 sm:px-8 lg:px-10">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="mb-3 text-2xl font-bold tracking-tight text-[#101C30] sm:text-3xl">
              Ready to bring clarity to your campus?
            </h2>
            <p className="mb-7 text-[#14355E]/70">
              Join institutions using Academicall for guided academic workflows.
            </p>
            <Link
              to={ctaPrimary}
              className="inline-flex items-center gap-2 rounded-lg bg-[#3D6FE0] px-7 py-3.5 text-sm font-semibold text-white shadow-md shadow-[#3D6FE0]/25 transition hover:bg-[#14355E]"
            >
              {signedIn ? "Open dashboard" : "Get started free"}
              <ArrowRight size={17} />
            </Link>
          </div>
        </section>
      </main>

      {/* ========== FOOTER ========== */}
      <footer className="border-t border-[#14355E]/08 bg-white px-5 py-12 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2 lg:col-span-1">
              <div className="mb-4">
                <img
                  src="/brand/logo-horizontal.png"
                  alt="Academicall"
                  className="h-8 w-auto object-contain"
                />
              </div>
              <p className="mb-4 text-sm leading-relaxed text-[#14355E]/70">
                Guided academic workflows for modern universities — clear, dependable,
                and elevated.
              </p>
              <p className="mb-1 text-xs font-medium text-[#14355E]/50">Surfwired Technologies</p>
              <div className="space-y-1.5 text-sm text-[#14355E]/70">
                <p className="flex items-center gap-2">
                  <MapPin size={14} className="text-[#3D6FE0]" />
                  Abuja, Nigeria
                </p>
                <p className="flex items-center gap-2">
                  <Phone size={14} className="text-[#3D6FE0]" />
                  <a href="tel:+2348152243717" className="hover:text-[#14355E]">0815 224 3717</a>
                </p>
                <p className="flex items-center gap-2">
                  <Mail size={14} className="text-[#3D6FE0]" />
                  <a href="mailto:info@surfwired.com" className="hover:text-[#14355E]">info@surfwired.com</a>
                </p>
              </div>
            </div>

            <div>
              <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-[#14355E]/45">Product</h4>
              <ul className="space-y-2 text-sm text-[#14355E]/70">
                <li><a href="#features" className="hover:text-[#3D6FE0]">Features</a></li>
                <li><a href="#how-it-works" className="hover:text-[#3D6FE0]">How it works</a></li>
                <li><a href="#download" className="hover:text-[#3D6FE0]">Download APK</a></li>
              </ul>
            </div>

            <div>
              <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-[#14355E]/45">Account</h4>
              <ul className="space-y-2 text-sm text-[#14355E]/70">
                <li><Link to="/login" className="hover:text-[#3D6FE0]">Sign in</Link></li>
                <li><Link to="/signup" className="hover:text-[#3D6FE0]">Sign up</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-[#14355E]/45">Legal</h4>
              <ul className="space-y-2 text-sm text-[#14355E]/70">
                <li><Link to="/privacy" className="hover:text-[#3D6FE0]">Privacy Policy</Link></li>
                <li><a href="#" className="hover:text-[#3D6FE0]">Terms of Service</a></li>
              </ul>
            </div>
          </div>

          <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-[#14355E]/08 pt-6 text-xs text-[#14355E]/45 sm:flex-row">
            <span>© {new Date().getFullYear()} Surfwired Technologies. All rights reserved.</span>
            <span>Academicall · Web & Android</span>
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes floatY {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-12px); }
        }
      `}</style>
    </div>
  );
}
