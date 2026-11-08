/** Full search results (from the top-bar search, or the search button on phones). */
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search, Loader2 } from "lucide-react";
import { PageHeader } from "../components/ui";
import { useGlobalSearch } from "../components/search/GlobalSearch";

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const [term, setTerm] = useState(params.get("q") || "");
  useEffect(() => { setTerm(params.get("q") || ""); }, [params]);
  const { groups, busy, empty } = useGlobalSearch(params.get("q") || "", 12);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader title="Search" />
      <form className="ctl-search" role="search" onSubmit={(e) => { e.preventDefault(); setParams(term.trim() ? { q: term.trim() } : {}); }}>
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
        <input autoFocus value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Courses, materials, groups, news, UTME subjects…" aria-label="Search" />
        <button type="submit" className="ctl-btn !py-1.5">Search</button>
      </form>
      {(params.get("q") || "").length < 2 && <p className="text-sm text-text-muted">Type at least two letters.</p>}
      {empty && <p className="ctl-panel text-sm text-text-secondary">Nothing matches “{params.get("q")}”. Try a course code like CSC 101, or fewer words.</p>}
      {groups.map((g) => (
        <section key={g.key} className="ctl-panel !p-0">
          <h2 className="ctl-panel-title">{g.title}</h2>
          <ul>
            {g.items.map((it) => (
              <li key={`${g.key}:${it.id}`} className="border-b border-border-subtle last:border-0">
                <Link to={it.to} className="block px-4 py-3 hover:bg-bg-panel-alt">
                  <span className="block font-medium text-text-primary">{it.title}</span>
                  {it.sub && <span className="block text-xs text-text-muted">{it.sub}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
