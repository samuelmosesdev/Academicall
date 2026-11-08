/**
 * One search box for the student side: app pages, courses, materials, study
 * groups, news and UTME subjects. The top bar shows a quick dropdown; Enter
 * opens the full results page (/dashboard/search?q=).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, Search } from "lucide-react";
import { searchApi } from "../../lib/gapsApi";
import { loadIndex } from "../../lib/utmeBank";
import { useFeatures } from "../../lib/features";
import { useAuth } from "../../context/AuthContext";
import { isAspirant } from "../../lib/roles";

const PAGES = [
  { label: "Dashboard", to: "/dashboard", words: "home" },
  { label: "My courses", to: "/dashboard/courses", feature: "courses", student: true, words: "add courses register" },
  { label: "Library", to: "/dashboard/materials", feature: "materials", student: true, words: "materials notes pdf handouts folders files" },
  { label: "Study groups", to: "/dashboard/groups", feature: "groups", student: true, words: "chat class group" },
  { label: "Timetable", to: "/dashboard/timetable", feature: "timetable", student: true, words: "classes lectures schedule" },
  { label: "Programme page", to: "/dashboard/department", feature: "programme", student: true, words: "department feed updates" },
  { label: "CGPA & results", to: "/dashboard/results", feature: "results", student: true, words: "gpa grades calculator class of degree" },
  { label: "Tests", to: "/dashboard/tests", feature: "tests", words: "exam quiz mock" },
  { label: "UTME CBT", to: "/dashboard/utme", feature: "utme", words: "jamb past questions practice" },
  { label: "UTME progress", to: "/dashboard/utme?tab=progress", feature: "utme", words: "weak topics goals streak" },
  { label: "Aspirant House", to: "/dashboard/house", feature: "aspirantHouse", aspirant: true, words: "house leader threads" },
  { label: "Downloads", to: "/dashboard/downloads", feature: "downloads", words: "offline saved data" },
  { label: "Vault", to: "/dashboard/vault", feature: "vault", words: "private files pin" },
  { label: "News", to: "/news", feature: "news", words: "stories campus" },
  { label: "Notifications", to: "/dashboard/notifications", words: "alerts" },
  { label: "Settings", to: "/dashboard/settings", words: "password privacy two-step security notifications data" },
];

export function useGlobalSearch(term, limit = 5) {
  const { isOn } = useFeatures();
  const { profile } = useAuth();
  const [remote, setRemote] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [busy, setBusy] = useState(false);
  const q = term.trim();

  useEffect(() => {
    if (!isOn("utme")) return;
    loadIndex().then((i) => setSubjects(i.subjects || [])).catch(() => {});
  }, [isOn]);

  useEffect(() => {
    if (q.length < 2 || !isOn("search")) { setRemote(null); return undefined; }
    setBusy(true);
    const t = setTimeout(() => {
      searchApi.search(q, limit).then(setRemote).catch(() => setRemote(null)).finally(() => setBusy(false));
    }, 250);
    return () => clearTimeout(t);
  }, [q, limit, isOn]);

  const local = useMemo(() => {
    if (q.length < 2) return { pages: [], utme: [] };
    const lq = q.toLowerCase();
    const asp = isAspirant(profile);
    const pages = PAGES.filter((p) => (!p.feature || isOn(p.feature)) && !(p.student && asp) && !(p.aspirant && !asp))
      .filter((p) => `${p.label} ${p.words || ""}`.toLowerCase().includes(lq)).slice(0, limit);
    const utme = subjects.filter((s) => s.name.toLowerCase().includes(lq)).slice(0, limit);
    return { pages, utme };
  }, [q, subjects, profile, isOn, limit]);

  const groups = [
    { key: "pages", title: "Pages", items: local.pages.map((p) => ({ id: p.to, title: p.label, to: p.to })) },
    { key: "courses", title: "Courses", items: (remote?.courses || []).map((c) => ({ id: c.id, title: `${c.code || ""} ${c.title ? `· ${c.title}` : ""}`.trim(), sub: c.mine ? "In my courses" : "Add from the catalogue", to: c.mine ? `/dashboard/materials/folder/${encodeURIComponent(c.code || "")}` : `/dashboard/courses?add=${encodeURIComponent(c.code || "")}` })) },
    { key: "materials", title: "Library", items: (remote?.materials || []).map((m) => ({ id: m.id, title: m.title, sub: [m.courseCode, m.level && `${m.level}L`].filter(Boolean).join(" · "), to: `/dashboard/reading-hub/doc/${m.id}` })) },
    { key: "groups", title: "Study groups", items: (remote?.groups || []).map((g) => ({ id: g.id, title: g.name, sub: `${g.memberCount} member${g.memberCount === 1 ? "" : "s"}`, to: `/dashboard/groups/${g.id}` })) },
    { key: "news", title: "News", items: (remote?.news || []).map((n) => ({ id: n.id, title: n.title, sub: n.category, to: `/news/${n.slug}` })) },
    { key: "utme", title: "UTME past questions", items: local.utme.map((s) => ({ id: s.slug, title: s.name, sub: `${s.count.toLocaleString()} questions`, to: `/dashboard/utme?subject=${s.slug}` })) },
  ].filter((g) => g.items.length);
  return { groups, busy, empty: q.length >= 2 && !busy && !groups.length };
}

export default function GlobalSearch() {
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();
  const { groups, busy, empty } = useGlobalSearch(term, 4);
  const { isOn } = useFeatures();

  useEffect(() => {
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  if (!isOn("search")) return null;

  return (
    <div ref={ref} className="relative hidden md:block">
      <form
        className="gsearch"
        onSubmit={(e) => { e.preventDefault(); if (term.trim().length >= 2) { setOpen(false); navigate(`/dashboard/search?q=${encodeURIComponent(term.trim())}`); } }}
        role="search"
      >
        {busy ? <Loader2 size={15} className="animate-spin text-ink-muted" /> : <Search size={15} className="text-ink-muted" />}
        <input
          value={term}
          onChange={(e) => { setTerm(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
          placeholder="Search courses, materials, groups…"
          aria-label="Search Academicall"
        />
      </form>
      {open && term.trim().length >= 2 && (
        <div className="gsearch-pop" role="listbox">
          {groups.map((g) => (
            <div key={g.key}>
              <p className="gsearch-h">{g.title}</p>
              {g.items.map((it) => (
                <Link key={`${g.key}:${it.id}`} to={it.to} className="gsearch-item" onClick={() => setOpen(false)}>
                  <span className="truncate">{it.title}</span>
                  {it.sub && <span className="gsearch-sub">{it.sub}</span>}
                </Link>
              ))}
            </div>
          ))}
          {empty && <p className="px-3 py-3 text-sm text-ink-muted">Nothing matches “{term.trim()}”.</p>}
          {!empty && <Link to={`/dashboard/search?q=${encodeURIComponent(term.trim())}`} className="gsearch-all" onClick={() => setOpen(false)}>See all results</Link>}
        </div>
      )}
    </div>
  );
}
