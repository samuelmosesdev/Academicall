import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUpRight, CornerDownLeft, Search, Sparkle, X } from "lucide-react";
import { newsApi } from "../../lib/newsApi";

/**
 * Search box that suggests as you type: matching headlines, word completions and
 * typo fixes ("Did you mean…"), so readers find the story in a few keystrokes.
 */
export default function NewsSearch({ value, onSearch, className = "" }) {
  const navigate = useNavigate();
  const [text, setText] = useState(value || "");
  const [open, setOpen] = useState(false);
  const [sugg, setSugg] = useState({ stories: [], terms: [], corrected: null });
  const [active, setActive] = useState(-1);
  const box = useRef(null);
  const ctrl = useRef(null);

  useEffect(() => { setText(value || ""); }, [value]);
  useEffect(() => {
    if (!open) return undefined;
    const t = setTimeout(() => {
      ctrl.current?.abort();
      ctrl.current = new AbortController();
      newsApi.suggest(text.trim(), { signal: ctrl.current.signal }).then((r) => { setSugg(r); setActive(-1); }).catch(() => {});
    }, text ? 140 : 0);
    return () => clearTimeout(t);
  }, [text, open]);
  useEffect(() => {
    const close = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const items = [
    ...(sugg.corrected ? [{ type: "fix", label: sugg.corrected }] : []),
    ...sugg.terms.map((t) => ({ type: "term", label: t })),
    ...sugg.stories.map((s) => ({ type: "story", label: s.title, story: s })),
  ];

  function run(q) {
    setText(q);
    setOpen(false);
    onSearch(q.trim());
  }
  function pick(item) {
    if (item.type === "story") { setOpen(false); navigate(`/news/${item.story.slug}`); return; }
    run(item.label);
  }

  return (
    <div ref={box} className={`relative ${className}`}>
      <label className={`flex items-center gap-2 rounded-full border bg-card-light px-4 py-2.5 transition ${open ? "border-violet shadow-[0_0_0_3px_rgba(69,74,222,.12)]" : "border-border-light"}`}>
        <Search size={16} className="text-ink-muted" />
        <input
          value={text}
          onChange={(e) => { setText(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((a) => Math.min(items.length - 1, a + 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(-1, a - 1)); }
            else if (e.key === "Enter") { e.preventDefault(); if (active >= 0 && items[active]) pick(items[active]); else run(text); }
            else if (e.key === "Escape") setOpen(false);
          }}
          placeholder="Search news: admission list, post-UTME, scholarships…"
          className="w-full bg-transparent text-sm outline-none placeholder:text-ink-muted"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-label="Search news"
        />
        {text && <button type="button" onClick={() => run("")} className="rounded-full p-0.5 text-ink-muted hover:text-ink" aria-label="Clear search"><X size={14} /></button>}
      </label>
      {open && items.length > 0 && (
        <div className="news-suggest" role="listbox">
          {!text && <p className="px-4 pb-1 pt-3 text-[0.7rem] font-bold uppercase tracking-[0.1em] text-ink-muted">Popular right now</p>}
          {items.map((it, i) => (
            <button
              key={`${it.type}-${it.label}-${i}`}
              type="button"
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => { e.preventDefault(); pick(it); }}
              className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm ${i === active ? "bg-violet-soft" : ""}`}
            >
              {it.type === "story" ? <ArrowUpRight size={15} className="shrink-0 text-violet" /> : it.type === "fix" ? <Sparkle size={15} className="shrink-0 text-violet" /> : <Search size={14} className="shrink-0 text-ink-muted" />}
              <span className="min-w-0 flex-1">
                {it.type === "fix" ? <span className="text-ink">Did you mean <b>{it.label}</b>?</span>
                  : it.type === "story" ? <><span className="block truncate font-medium text-ink">{it.label}</span><span className="text-xs text-ink-muted">{it.story.category}</span></>
                    : <Highlight text={it.label} q={text} />}
              </span>
              {i === active && <CornerDownLeft size={13} className="shrink-0 text-ink-muted" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Highlight({ text, q }) {
  const last = q.trim().split(/\s+/).pop()?.toLowerCase() || "";
  const words = text.split(" ");
  return (
    <span className="text-ink">
      {words.map((w, i) => (
        <span key={i}>{i ? " " : ""}{last && w.toLowerCase().startsWith(last) ? <><span>{w.slice(0, last.length)}</span><b>{w.slice(last.length)}</b></> : w}</span>
      ))}
    </span>
  );
}
