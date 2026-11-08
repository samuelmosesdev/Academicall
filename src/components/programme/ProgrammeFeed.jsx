import { useEffect, useRef, useState } from "react";
import {
  BookmarkCheck,
  BookmarkPlus,
  CalendarPlus,
  Clock,
  ExternalLink,
  FileText,
  Loader2,
  MapPin,
  Megaphone,
  MessageCircle,
  Pin,
  Send,
  Trash2,
  Upload,
} from "lucide-react";
import UserAvatar from "../UserAvatar";
import LinkifiedText from "../LinkifiedText";

/* ------------------------------- helpers ------------------------------- */

export function toMillis(ts) {
  if (!ts) return 0;
  if (typeof ts === "number") return ts;
  if (ts.toDate) return ts.toDate().getTime();
  if (ts.seconds) return ts.seconds * 1000;
  const ms = new Date(ts).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

export function relTime(ts) {
  const ms = toMillis(ts);
  if (!ms) return "";
  const diff = Date.now() - ms;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(ms).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    ...(new Date(ms).getFullYear() !== new Date().getFullYear() ? { year: "numeric" } : {}),
  });
}

export function formatBytes(n) {
  const v = Number(n);
  if (!v) return "";
  if (v < 1024) return `${v} B`;
  if (v < 1024 * 1024) return `${Math.round(v / 1024)} KB`;
  return `${(v / (1024 * 1024)).toFixed(v < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

function fileExt(name = "", url = "") {
  const src = String(name || url || "").split("?")[0];
  const m = src.match(/\.([a-z0-9]{2,5})$/i);
  return m ? m[1].toUpperCase() : "FILE";
}

/** Strip anything that looks like an e-mail so it never shows as a name. */
export function safeName(name, fallback = "Course Rep") {
  const n = String(name || "").trim();
  return n && !n.includes("@") ? n : fallback;
}

/* ------------------------------ reactions ------------------------------ */

const REACTIONS = [
  { type: "like", emoji: "👍", label: "Acknowledge" },
  { type: "haha", emoji: "😂", label: "Haha" },
  { type: "love", emoji: "❤️", label: "Love" },
];

function countReactions(list) {
  const counts = { like: 0, haha: 0, love: 0 };
  (list || []).forEach((r) => {
    if (counts[r.type] !== undefined) counts[r.type] += 1;
  });
  return counts;
}

/**
 * Reaction summary + picker. Tap toggles your reaction (or opens the picker if
 * you haven't reacted); long-press / right-click always opens the picker.
 */
export function ReactionBar({ reactions, onReact, uid, size = "md" }) {
  const [open, setOpen] = useState(false);
  const [hoverType, setHoverType] = useState(null);
  const timerRef = useRef(null);
  const heldRef = useRef(false);
  const rootRef = useRef(null);
  const counts = countReactions(reactions);
  const mine = uid ? (reactions || []).find((r) => r.uid === uid)?.type || null : null;
  const total = (reactions || []).length;
  const present = REACTIONS.filter((r) => counts[r.type] > 0).sort((a, b) => counts[b.type] - counts[a.type]);

  const clearTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
        setHoverType(null);
      }
    };
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, [open]);

  useEffect(() => () => clearTimer(), []);

  const pick = (type) => {
    onReact(type);
    setOpen(false);
    setHoverType(null);
  };

  const isSm = size === "sm";

  return (
    <div ref={rootRef} className="relative inline-flex items-center">
      <button
        type="button"
        title={mine ? "Tap to remove · hold to change" : "React"}
        onPointerDown={() => {
          heldRef.current = false;
          clearTimer();
          timerRef.current = setTimeout(() => {
            heldRef.current = true;
            setOpen(true);
            setHoverType(mine || "like");
          }, 380);
        }}
        onPointerUp={clearTimer}
        onPointerLeave={clearTimer}
        onPointerCancel={clearTimer}
        onContextMenu={(e) => {
          e.preventDefault();
          setOpen(true);
          setHoverType(mine || "like");
        }}
        onClick={() => {
          if (heldRef.current) return;
          if (mine) onReact(mine);
          else {
            setOpen(true);
            setHoverType("like");
          }
        }}
        className={`inline-flex select-none items-center gap-1.5 rounded-full border transition ${
          isSm ? "h-7 px-2 text-xs" : "h-8 px-2.5 text-sm"
        } ${
          mine
            ? "border-teal/40 bg-teal-soft text-teal"
            : "border-border-light bg-card-light text-ink-muted hover:border-border-strong hover:text-ink"
        }`}
      >
        {present.length > 0 ? (
          <>
            <span className="flex items-center leading-none">
              {present.slice(0, 3).map((r) => (
                <span key={r.type}>{r.emoji}</span>
              ))}
            </span>
            <span className="text-xs font-semibold tabular-nums">{total}</span>
          </>
        ) : (
          <span className="flex items-center gap-1">
            <span className="opacity-70">👍</span>
            <span className="text-xs font-medium">React</span>
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute bottom-full left-0 z-30 mb-2 flex items-center gap-0.5 rounded-full border border-border-light bg-card-light px-1.5 py-1 shadow-lg"
          onPointerLeave={() => setHoverType(null)}
        >
          {REACTIONS.map(({ type, emoji, label }) => {
            const active = hoverType === type || mine === type;
            return (
              <button
                key={type}
                type="button"
                title={label}
                aria-label={label}
                onPointerEnter={() => setHoverType(type)}
                onClick={() => pick(type)}
                className={`flex h-10 w-10 items-center justify-center rounded-full text-xl transition-transform duration-150 ${
                  active ? "scale-110 bg-teal-soft" : "hover:bg-surface-light"
                }`}
              >
                {emoji}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------- comments ------------------------------ */

export function CommentThread({ comments = [], uid, open, onToggle, value, onChange, onSubmit, busy, onReactComment }) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium text-ink-muted transition hover:bg-surface-light hover:text-ink"
      >
        <MessageCircle size={14} />
        {comments.length ? `${comments.length} comment${comments.length !== 1 ? "s" : ""}` : "Comment"}
      </button>

      {open && (
        <div className="mt-3 space-y-2.5 border-t border-border-light pt-3">
          {comments.length === 0 && <p className="text-xs text-ink-muted">No comments yet.</p>}
          {comments.map((c) => (
            <div key={c.id} className="flex gap-2.5">
              <UserAvatar
                name={c.authorName || "Student"}
                nickname={c.authorNickname}
                photoURL={c.authorPhoto}
                role={c.authorRole}
                plan={c.authorPlan}
                subscription={c.authorSubscription}
                size={28}
              />
              <div className="min-w-0 flex-1">
                <div className="rounded-2xl rounded-tl-md bg-surface-light px-3 py-2">
                  <p className="text-xs font-semibold text-ink">
                    {safeName(c.authorNickname || c.authorName, "Student")}
                    {c.createdAt && <span className="ml-1.5 font-normal text-ink-muted">· {relTime(c.createdAt)}</span>}
                  </p>
                  <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-ink"><LinkifiedText text={c.text} /></p>
                </div>
                <div className="mt-1">
                  <ReactionBar size="sm" uid={uid} reactions={c.reactions} onReact={(type) => onReactComment(c.id, type)} />
                </div>
              </div>
            </div>
          ))}
          <form
            className="flex items-center gap-2 pt-1"
            onSubmit={(e) => {
              e.preventDefault();
              onSubmit();
            }}
          >
            <input
              className="h-10 min-w-0 flex-1 rounded-full border border-border-light bg-card-light px-4 text-sm text-ink placeholder:text-ink-muted focus:border-teal focus:outline-none"
              placeholder="Write a comment…"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              enterKeyHint="send"
            />
            <button
              type="submit"
              disabled={busy || !String(value || "").trim()}
              aria-label="Send comment"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal text-white transition hover:bg-teal-dark disabled:opacity-50"
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ post card ------------------------------ */

const TYPE_META = {
  announcement: { label: "Announcement", Icon: Megaphone, tone: "text-teal bg-teal-soft" },
  update: { label: "Update", Icon: Megaphone, tone: "text-teal bg-teal-soft" },
  class: { label: "Class", Icon: Clock, tone: "text-aqua-deep bg-aqua-soft dark:bg-aqua/15 dark:text-aqua" },
  material: { label: "Material", Icon: FileText, tone: "text-ink bg-lemon-soft dark:bg-lemon/15 dark:text-lemon" },
};

export function TypeChip({ type }) {
  const meta = TYPE_META[type] || TYPE_META.update;
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.7rem] font-semibold ${meta.tone}`}>
      <meta.Icon size={11} strokeWidth={2.4} />
      {meta.label}
    </span>
  );
}

/** Long bodies fold to a few lines with a "Read more". */
function Body({ text }) {
  const [expanded, setExpanded] = useState(false);
  if (!text) return null;
  const long = text.length > 420 || text.split("\n").length > 7;
  return (
    <div className="mt-1.5">
      <p className={`whitespace-pre-wrap break-words text-[0.9375rem] leading-relaxed text-ink/85 ${long && !expanded ? "line-clamp-6" : ""}`}>
        <LinkifiedText text={text} />
      </p>
      {long && (
        <button type="button" onClick={() => setExpanded((v) => !v)} className="mt-1 text-sm font-medium text-teal hover:underline">
          {expanded ? "Show less" : "Read more"}
        </button>
      )}
    </div>
  );
}

export function ClassDateBlock({ start, end, venue, notes }) {
  const s = start ? new Date(toMillis(start)) : null;
  const e = end ? new Date(toMillis(end)) : null;
  if (!s) return null;
  const time = (d) => d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const today = new Date();
  const tomorrow = new Date(today.getTime() + 86400000);
  const sameDay = (a, b) => a.toDateString() === b.toDateString();
  const dayLabel = sameDay(s, today) ? "Today" : sameDay(s, tomorrow) ? "Tomorrow" : s.toLocaleDateString([], { weekday: "long" });
  return (
    <div className="mt-3 flex items-stretch gap-3 rounded-xl border border-border-light bg-surface-light p-3">
      <div className="flex w-14 shrink-0 flex-col items-center justify-center rounded-lg border border-border-light bg-card-light py-1.5 text-center">
        <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-ink-muted">
          {s.toLocaleDateString([], { month: "short" })}
        </span>
        <span className="font-display text-2xl leading-none text-ink">{s.getDate()}</span>
      </div>
      <div className="min-w-0 flex-1 space-y-1 py-0.5 text-sm">
        <p className="font-medium text-ink">
          {dayLabel} · {time(s)}
          {e ? `–${time(e)}` : ""}
        </p>
        {venue && (
          <p className="flex items-center gap-1.5 text-ink-muted">
            <MapPin size={13} className="shrink-0" />
            <span className="truncate">{venue}</span>
          </p>
        )}
        {notes && <p className="whitespace-pre-wrap break-words text-ink-muted">{notes}</p>}
      </div>
    </div>
  );
}

export function FileRow({ name, url, size, saved, saving, onSave }) {
  const ext = fileExt(name, url);
  return (
    <div className="mt-3 flex items-center gap-3 rounded-xl border border-border-light bg-surface-light p-2.5 pr-2">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border-light bg-card-light text-[0.65rem] font-bold tracking-wide text-ink-muted">
        {ext}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{name || "Attachment"}</p>
        {size ? <p className="text-xs text-ink-muted">{formatBytes(size)}</p> : null}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center gap-1 rounded-lg px-2.5 text-xs font-medium text-ink transition hover:bg-card-light"
          >
            <ExternalLink size={13} /> <span className="hidden min-[380px]:inline">Open</span>
          </a>
        )}
        {onSave && (
          <button
            type="button"
            onClick={onSave}
            disabled={saved || saving}
            aria-label={saved ? "Saved to Library" : "Save to Library"}
            title={saved ? "Saved to Library" : "Save to Library"}
            className={`inline-flex h-9 items-center gap-1 rounded-lg px-2.5 text-xs font-medium transition ${
              saved ? "text-teal" : "text-ink hover:bg-card-light"
            } disabled:cursor-default`}
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : saved ? <BookmarkCheck size={13} /> : <BookmarkPlus size={13} />}
            <span className="hidden min-[380px]:inline">{saved ? "Saved" : "Save"}</span>
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * One item in the programme feed: header (rep, badge, time, type), title,
 * body, then a type-specific block (class date / file row), then reactions
 * and comments.
 */
export function FeedCard({ type, author, authorPhoto, authorRole, time, pinned, courseCode, title, children, footer, onDelete }) {
  return (
    <article className={`card-stitch p-4 sm:p-5 ${pinned ? "border-teal/35" : ""}`}>
      <header className="flex items-start gap-3">
        <UserAvatar name={author} photoURL={authorPhoto} role={authorRole || "courseRep"} size={40} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <span className="truncate text-sm font-semibold text-ink">{author}</span>
            {(authorRole || "courseRep") === "courseRep" && (
              <span className="rounded-md bg-aqua-soft px-1.5 py-0.5 text-[0.65rem] font-semibold text-aqua-deep dark:bg-aqua/15 dark:text-aqua">
                Course Rep
              </span>
            )}
            {time && <span className="text-xs text-ink-muted">· {time}</span>}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <TypeChip type={type} />
            {courseCode && (
              <span className="rounded-md border border-border-light px-1.5 py-0.5 text-[0.7rem] font-semibold tracking-wide text-ink-muted">
                {courseCode}
              </span>
            )}
            {pinned && (
              <span className="inline-flex items-center gap-1 text-[0.7rem] font-semibold text-teal">
                <Pin size={11} strokeWidth={2.4} /> Pinned
              </span>
            )}
          </div>
        </div>
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            aria-label="Delete this post"
            title="Delete this post"
            className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-muted transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
          >
            <Trash2 size={15} />
          </button>
        )}
      </header>
      {title && <h3 className="mt-3 break-words text-base font-semibold leading-snug text-ink">{title}</h3>}
      {children}
      {footer && <div className="mt-3 flex flex-wrap items-start gap-2">{footer}</div>}
    </article>
  );
}

export { Body as PostBody };

/* ------------------------------- composer ------------------------------ */

/**
 * What a Course Rep sees at the top of their class page: one obvious place to
 * write to the class, plus the two other things they post (a class, a file).
 */
export function RepComposer({ profile, audience, onPost, onSchedule, onUpload }) {
  const first = String(profile?.nickname || profile?.name || "").split(" ")[0];
  return (
    <section className="rounded-2xl border border-border-light bg-card-light p-3 sm:p-4" aria-label="Post to your class">
      <div className="flex items-center gap-3">
        <UserAvatar profile={profile} size={40} />
        <button
          type="button"
          onClick={onPost}
          className="flex h-11 min-w-0 flex-1 items-center rounded-full border border-border-light bg-surface-light px-4 text-left text-sm text-ink-muted transition hover:border-border-strong"
        >
          <span className="truncate">
            {first ? `${first}, w` : "W"}rite to {audience || "your class"}…
          </span>
        </button>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-1 border-t border-border-light pt-2.5">
        {[
          { label: "Update", Icon: Megaphone, onClick: onPost },
          { label: "Class", Icon: CalendarPlus, onClick: onSchedule },
          { label: "Material", Icon: Upload, onClick: onUpload },
        ].map(({ label, Icon, onClick }) => (
          <button
            key={label}
            type="button"
            onClick={onClick}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg text-sm font-medium text-ink-muted transition hover:bg-surface-light hover:text-ink"
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>
    </section>
  );
}

export function FilterTabs({ value, onChange, options }) {
  return (
    <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5" role="tablist" aria-label="Filter the feed">
      {options.map(([key, label, count]) => (
        <button
          key={key}
          type="button"
          role="tab"
          aria-selected={value === key}
          onClick={() => onChange(key)}
          className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition ${
            value === key ? "bg-ink text-bg-app" : "border border-border-light text-ink-muted hover:text-ink"
          }`}
        >
          {label}
          {count > 0 && <span className={value === key ? "opacity-70" : "text-ink-muted/80"}>{count}</span>}
        </button>
      ))}
    </div>
  );
}

export function EmptyFeed({ filter, isRep }) {
  const copy = {
    all: isRep
      ? ["Nothing posted yet", "Share a first update, schedule a class or upload a file. Everyone in your class will see it here."]
      : ["Nothing posted yet", "When your Course Rep shares an update, a class or a file, it'll show up here."],
    updates: ["No updates yet", isRep ? "Use the box above to write to your class." : "Announcements from your Course Rep will appear here."],
    classes: ["No upcoming classes", isRep ? "Schedule one and your class gets the time and venue." : "Scheduled classes and their venues will appear here."],
    materials: ["No materials yet", isRep ? "Upload notes or slides from your Course Rep panel." : "Notes and slides from your Course Rep will appear here."],
  }[filter] || ["Nothing here", ""];
  return (
    <div className="rounded-2xl border border-dashed border-border-strong px-6 py-12 text-center">
      <p className="text-sm font-medium text-ink">{copy[0]}</p>
      {copy[1] && <p className="mx-auto mt-1 max-w-xs text-sm text-ink-muted">{copy[1]}</p>}
    </div>
  );
}
