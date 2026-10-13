import { BadgeCheck } from "lucide-react";
import { imageThumb } from "../../lib/groupUploads";

const TONES = [
  "bg-violet text-white",
  "bg-lemon text-midnight",
  "bg-aqua text-midnight",
  "bg-midnight text-lemon",
  "bg-violet-soft text-violet-deep",
  "bg-aqua-soft text-aqua-deep",
];

function hash(str = "") {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

export function initials(name = "") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
}

export function GroupAvatar({ group, size = 44, className = "" }) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.36) };
  if (group?.iconUrl) {
    return (
      <img
        src={imageThumb(group.iconUrl, size * 3)}
        alt=""
        style={style}
        className={`shrink-0 rounded-2xl object-cover ring-1 ring-black/5 ${className}`}
        loading="lazy"
      />
    );
  }
  return (
    <span style={style} className={`flex shrink-0 items-center justify-center rounded-2xl font-display font-semibold ${TONES[hash(group?.id || group?.name) % TONES.length]} ${className}`}>
      {initials(group?.name)}
    </span>
  );
}

export function PersonAvatar({ person, size = 32, className = "" }) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.38) };
  if (person?.photoUrl) {
    return <img src={imageThumb(person.photoUrl, size * 3)} alt="" style={style} className={`shrink-0 rounded-full object-cover ${className}`} loading="lazy" />;
  }
  return (
    <span style={style} className={`flex shrink-0 items-center justify-center rounded-full font-semibold ${TONES[hash(person?.id || person?.userId || person?.name) % TONES.length]} ${className}`}>
      {initials(person?.name)}
    </span>
  );
}

export function OfficialBadge({ className = "" }) {
  return (
    <span title="Created by a course representative for this class" className={`inline-flex items-center gap-1 rounded-full bg-lemon-soft px-2 py-0.5 text-[10px] font-semibold text-midnight ${className}`}>
      <BadgeCheck size={11} /> Class group
    </span>
  );
}

export function RoleBadge({ role }) {
  if (role === "creator") return <span className="rounded-full bg-midnight px-2 py-0.5 text-[10px] font-semibold text-lemon">Creator</span>;
  if (role === "moderator") return <span className="rounded-full bg-violet-soft px-2 py-0.5 text-[10px] font-semibold text-violet-deep">Moderator</span>;
  return null;
}

const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** "14:05", "Yesterday", "Mon", "12/10/26" — like a messaging app list. */
export function listTime(value) {
  if (!value) return "";
  const d = new Date(value);
  const now = new Date();
  if (sameDay(d, now)) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (sameDay(d, y)) return "Yesterday";
  if (now - d < 6 * 864e5) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { day: "2-digit", month: "2-digit", year: "2-digit" });
}

export function bubbleTime(value) {
  return value ? new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
}

export function dayLabel(value) {
  const d = new Date(value);
  const now = new Date();
  if (sameDay(d, now)) return "Today";
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (sameDay(d, y)) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long", year: d.getFullYear() === now.getFullYear() ? undefined : "numeric" });
}

export function isSameDay(a, b) {
  return sameDay(new Date(a), new Date(b));
}
