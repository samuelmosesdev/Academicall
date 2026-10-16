import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { AtSign, Loader2 } from "lucide-react";
import { housesApi, mentionToken, MENTION_RX } from "../../lib/aspirantApi";

const URL_RX = /(https?:\/\/[^\s<]+[^\s<.,:;"')\]])/g;

function linkify(text, keyBase) {
  const parts = text.split(URL_RX);
  return parts.map((p, i) =>
    i % 2 === 1 ? <a key={`${keyBase}-${i}`} href={p} target="_blank" rel="noreferrer" className="font-medium text-accent underline underline-offset-2">{p.replace(/^https?:\/\//, "")}</a> : <Fragment key={`${keyBase}-${i}`}>{p}</Fragment>,
  );
}

/** Renders a post body: paragraphs, links and @mention chips. */
export function MentionText({ text = "", meId, className = "" }) {
  const blocks = String(text).split(/\n{2,}/);
  return (
    <div className={`space-y-3 ${className}`}>
      {blocks.map((block, b) => {
        const out = [];
        let last = 0;
        const rx = new RegExp(MENTION_RX.source, "gi");
        let m;
        while ((m = rx.exec(block))) {
          if (m.index > last) out.push(...linkify(block.slice(last, m.index), `${b}-t${last}`));
          out.push(<span key={`${b}-m${m.index}`} className={`house-mention ${m[2] === meId ? "is-me" : ""}`}>@{m[1]}</span>);
          last = m.index + m[0].length;
        }
        if (last < block.length) out.push(...linkify(block.slice(last), `${b}-t${last}`));
        return <p key={b} className="whitespace-pre-line">{out}</p>;
      })}
    </div>
  );
}

/**
 * Textarea with an @mention picker (House Leaders only). People appear as "@Name" while
 * typing; on submit, `serialize()` turns each picked name into a mention token.
 */
export function useMentionField(houseId, enabled) {
  const [value, setValue] = useState("");
  const [picked, setPicked] = useState([]); // [{ id, name }]
  const serialize = () => {
    let out = value;
    for (const p of [...picked].sort((a, b) => b.name.length - a.name.length)) {
      out = out.split(`@${p.name}`).join(mentionToken(p.name, p.id));
    }
    return out;
  };
  const reset = () => { setValue(""); setPicked([]); };
  return { value, setValue, picked, setPicked, serialize, reset, houseId, enabled };
}

export function MentionTextarea({ field, placeholder, rows = 4, className = "", autoFocus, onKeyDown: outerKeyDown }) {
  const { value, setValue, setPicked, houseId, enabled } = field;
  const ref = useRef(null);
  const [query, setQuery] = useState(null); // text after "@"
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (!enabled || query === null) return undefined;
    let alive = true;
    setLoading(true);
    const t = setTimeout(() => {
      housesApi.members(houseId, { q: query, pageSize: 8 })
        .then((r) => alive && setPeople(r.members || []))
        .catch(() => alive && setPeople([]))
        .finally(() => alive && setLoading(false));
    }, 180);
    return () => { alive = false; clearTimeout(t); };
  }, [query, houseId, enabled]);

  function detect(next, caret) {
    if (!enabled) return;
    const upto = next.slice(0, caret);
    const m = /(^|\s)@([\p{L}\p{N} .'-]{0,30})$/u.exec(upto);
    if (m && !/\s{2}/.test(m[2])) { setQuery(m[2]); setActive(0); } else setQuery(null);
  }

  function choose(person) {
    const el = ref.current;
    const caret = el?.selectionStart ?? value.length;
    const upto = value.slice(0, caret);
    const start = upto.lastIndexOf("@");
    const name = person.name.trim();
    const next = `${value.slice(0, start)}@${name} ${value.slice(caret)}`;
    setValue(next);
    setPicked((p) => (p.some((x) => x.id === person.id) ? p : [...p, { id: person.id, name }]));
    setQuery(null);
    requestAnimationFrame(() => {
      const pos = start + name.length + 2;
      el?.focus();
      el?.setSelectionRange(pos, pos);
    });
  }

  function insertAt() {
    const el = ref.current;
    const caret = el?.selectionStart ?? value.length;
    const needsSpace = caret > 0 && !/\s/.test(value[caret - 1]);
    const next = `${value.slice(0, caret)}${needsSpace ? " " : ""}@${value.slice(caret)}`;
    setValue(next);
    setQuery("");
    requestAnimationFrame(() => { const pos = caret + (needsSpace ? 2 : 1); el?.focus(); el?.setSelectionRange(pos, pos); });
  }

  const open = enabled && query !== null;
  const list = useMemo(() => people.slice(0, 8), [people]);

  return (
    <div className="relative">
      <textarea
        ref={ref}
        rows={rows}
        value={value}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onChange={(e) => { setValue(e.target.value); detect(e.target.value, e.target.selectionStart); }}
        onClick={(e) => detect(value, e.target.selectionStart)}
        onKeyDown={(e) => {
          if (open && list.length) {
            if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % list.length); return; }
            if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a - 1 + list.length) % list.length); return; }
            if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); choose(list[active]); return; }
          }
          if (open && e.key === "Escape") { setQuery(null); return; }
          outerKeyDown?.(e);
        }}
        className={`acx-input resize-y leading-relaxed ${className}`}
      />
      {enabled && (
        <button type="button" onClick={insertAt} className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-lg bg-bg-panel-alt px-2 py-1 text-[11px] font-semibold text-text-secondary hover:text-accent" title="Mention a member">
          <AtSign size={12} /> Mention
        </button>
      )}
      {open && (
        <div className="house-mention-pop" role="listbox" aria-label="Mention a member">
          <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.08em] text-text-muted">Mention a house member</p>
          {loading && !list.length && <p className="flex items-center gap-2 px-3 py-2 text-xs text-text-muted"><Loader2 size={12} className="animate-spin" /> Looking…</p>}
          {!loading && !list.length && <p className="px-3 py-2 text-xs text-text-muted">No member matches “{query}”.</p>}
          {list.map((p, i) => (
            <button key={p.id} type="button" role="option" aria-selected={i === active} onMouseDown={(e) => { e.preventDefault(); choose(p); }}
              className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm ${i === active ? "bg-accent-soft" : "hover:bg-bg-panel-alt"}`}>
              <Avatar person={p} size={26} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-text-primary">{p.name}</span>
                <span className="block truncate text-[11px] text-text-muted">{p.choices?.[0]?.course || (p.choiceRank === 1 ? "First choice" : p.choiceRank === 2 ? "Second choice" : "Member")}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Avatar({ person, size = 34 }) {
  const initials = (person?.name || "?").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return person?.photoUrl ? (
    <img src={person.photoUrl} alt="" className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span className="flex shrink-0 items-center justify-center rounded-full bg-violet-soft font-semibold text-violet" style={{ width: size, height: size, fontSize: size * 0.38 }}>{initials}</span>
  );
}
