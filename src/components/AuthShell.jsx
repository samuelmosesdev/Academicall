import { Link } from "react-router-dom";

/**
 * Auth layout — calm paper form on the left; on desktop, a campus photograph
 * on the right with a single lemon "ticket" card. Phones get a short photo banner.
 */
const SCENES = {
  login: {
    src: "/images/campus/student-library.webp",
    pos: "object-[50%_28%]",
    kicker: "Your semester",
    title: "Classes, reading and practice",
    meta: "One academic home",
    line: "Pick up exactly where you stopped reading.",
  },
  signup: {
    src: "/images/campus/hero-campus.webp",
    pos: "object-[62%_center]",
    kicker: "Get started",
    title: "Your academic home",
    meta: "Courses · reading · practice",
    line: "Your department, your level, your semester — sorted.",
  },
  reset: {
    src: "/images/campus/library-wide.webp",
    pos: "object-[70%_center]",
    kicker: "Password help",
    title: "Back to your account",
    meta: "Secure account recovery",
    line: "Locked out happens. Let's get you back in.",
  },
};

export default function AuthShell({ scene = "login", title, subtitle, children, footer }) {
  const s = SCENES[scene] || SCENES.login;
  return (
    <div className="min-h-screen bg-paper text-midnight lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {/* Phone banner */}
      <div className="relative h-48 overflow-hidden lg:hidden">
        <img src={s.src} alt="" aria-hidden className={`h-full w-full object-cover ${s.pos}`} />
        <div className="absolute inset-0 bg-gradient-to-b from-midnight/20 via-transparent to-paper" />
        <Link to="/" className="absolute left-5 top-5 rounded-full bg-white/95 px-4 py-2.5 shadow-sm">
          <img src="/brand/logo-horizontal.png" alt="Academicall" className="h-[18px] w-auto" />
        </Link>
      </div>

      {/* Form */}
      <div className="flex flex-col px-6 pb-12 sm:px-12 lg:min-h-screen lg:px-16 lg:py-10 xl:px-28">
        <div className="hidden items-center justify-between lg:flex">
          <Link to="/" aria-label="Academicall home">
            <img src="/brand/logo-horizontal.png" alt="Academicall" className="h-[26px] w-auto" />
          </Link>
          <Link to="/" className="text-sm text-midnight/55 hover:text-midnight">← Back to site</Link>
        </div>

        <div className="mx-auto w-full max-w-[25rem] pt-4 lg:flex lg:flex-1 lg:flex-col lg:justify-center lg:pt-0">
          <h1 className="font-display text-[2.4rem] font-[380] leading-[1.04] tracking-[-0.03em] sm:text-[2.9rem]">{title}</h1>
          {subtitle && <p className="mt-3 text-[1rem] leading-relaxed text-midnight/60">{subtitle}</p>}
          <div className="mt-10">{children}</div>
          {footer && <div className="mt-10 border-t border-midnight/10 pt-6 text-[0.92rem] text-midnight/65">{footer}</div>}
        </div>

        <p className="mt-10 hidden text-xs text-midnight/40 lg:block">
          © {new Date().getFullYear()} Surfwired Technologies · <Link to="/privacy" className="hover:text-midnight">Privacy</Link>
        </p>
      </div>

      {/* Photo */}
      <div className="relative hidden p-4 lg:block">
        <div className="relative h-full overflow-hidden rounded-[2rem]">
          <img src={s.src} alt="" aria-hidden className={`absolute inset-0 h-full w-full object-cover ${s.pos}`} />
          <div className="absolute inset-0 bg-gradient-to-t from-midnight/85 via-midnight/10 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-10 xl:p-14">
            <div className="float-card mb-10 w-72 bg-lemon p-5 text-midnight">
              <span className="eyebrow text-midnight/55">{s.kicker}</span>
              <p className="mt-3 text-[1.05rem] font-semibold leading-snug">{s.title}</p>
              <div className="ticket-rule mt-4" />
              <p className="mt-3 text-[0.84rem] text-midnight/70">{s.meta}</p>
            </div>
            <p className="max-w-md font-display text-[2.2rem] font-[350] leading-[1.12] tracking-[-0.02em] text-white">{s.line}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Field({ label, children, hint, action }) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center justify-between text-[0.82rem] font-medium text-midnight/75">
        {label}
        {action}
      </span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-midnight/50">{hint}</span>}
    </label>
  );
}

export function AuthError({ children }) {
  if (!children) return null;
  return (
    <p role="alert" className="mb-6 rounded-2xl border border-[#e0453a]/20 bg-[#e0453a]/[0.06] px-4 py-3 text-sm text-[#b8352c]">
      {children}
    </p>
  );
}

export function AuthNote({ children }) {
  return <p className="rounded-2xl bg-aqua-soft px-4 py-3.5 text-sm leading-relaxed text-midnight/80">{children}</p>;
}

export function PrimaryButton({ children, className = "", ...props }) {
  return (
    <button
      {...props}
      className={`w-full rounded-full bg-midnight py-4 text-[0.95rem] font-medium text-white transition hover:bg-midnight-2 disabled:opacity-60 ${className}`}
    >
      {children}
    </button>
  );
}

export function Divider() {
  return (
    <div className="my-7 flex items-center gap-4">
      <div className="h-px flex-1 bg-midnight/10" />
      <span className="eyebrow text-midnight/40">or</span>
      <div className="h-px flex-1 bg-midnight/10" />
    </div>
  );
}
