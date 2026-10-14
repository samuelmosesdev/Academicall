import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, PenSquare } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { canWriteNews, homePathFor } from "../../lib/roles";

/**
 * Public chrome for Academicall News. Works signed in or out, so people can
 * read the news without going through the dashboard.
 */
export default function NewsShell({ children, title }) {
  const { user, profile } = useAuth();
  const location = useLocation();
  const signedIn = !!user;

  useEffect(() => {
    document.title = title ? `${title} · Academicall News` : "Academicall News";
  }, [title]);

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="news-masthead">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3.5 sm:px-6">
          <Link to="/news" className="flex items-center gap-2.5" aria-label="Academicall News home">
            <img src="/brand/mark-full-color.png" alt="" className="h-8 w-8" />
            <span className="leading-none">
              <span className="block font-logo text-[1.05rem] font-bold tracking-tight">academicall</span>
              <span className="eyebrow text-[0.6rem] text-violet">News</span>
            </span>
          </Link>
          <span className="ml-2 hidden h-5 w-px bg-border-light sm:block" />
          <p className="hidden text-xs text-ink-muted sm:block">
            {new Date().toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
          <div className="ml-auto flex items-center gap-2">
            {signedIn && canWriteNews(profile) && (
              <Link to="/news/desk" className="hidden items-center gap-1.5 rounded-full border border-border-light bg-card-light px-4 py-2 text-sm font-medium text-ink hover:border-violet sm:inline-flex">
                <PenSquare size={15} /> News desk
              </Link>
            )}
            {signedIn ? (
              <Link to={homePathFor(profile)} className="btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-sm">
                <LayoutDashboard size={15} /> <span className="hidden sm:inline">Dashboard</span>
              </Link>
            ) : (
              <>
                <Link to="/login" state={{ from: location }} className="hidden whitespace-nowrap px-3 py-2 text-sm font-medium text-ink hover:text-violet sm:inline">Sign in</Link>
                <Link to="/signup" state={{ from: location }} className="btn-warm hidden whitespace-nowrap rounded-full px-4 py-2 text-sm sm:inline-flex">Create account</Link>
                <Link to="/login" state={{ from: location }} className="btn-warm whitespace-nowrap rounded-full px-4 py-2 text-sm sm:hidden">Sign in</Link>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 pb-20 pt-6 sm:px-6 sm:pt-10">{children}</main>
      <footer className="border-t border-border-light">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-8 text-xs text-ink-muted sm:px-6">
          <span>© {new Date().getFullYear()} Academicall News · Written by the Academicall news team</span>
          <span className="flex gap-4"><Link to="/" className="hover:text-ink">Academicall</Link><Link to="/privacy" className="hover:text-ink">Privacy</Link></span>
        </div>
      </footer>
    </div>
  );
}
