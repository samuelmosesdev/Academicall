// Small date helpers for lecture scheduling. All values are in the
// device's local time; ISO strings are produced only at submit time.

export const pad = (n) => String(n).padStart(2, "0");

export function toYmd(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromYmd(s) {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function sameDay(a, b) {
  return (
    a && b &&
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** "14:30" -> "2:30 PM" */
export function formatTime(hhmm) {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad(m)} ${suffix}`;
}

export function formatDateLong(ymd) {
  const d = fromYmd(ymd);
  if (!d) return "";
  return d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
}

export function formatDateShort(ymd) {
  const d = fromYmd(ymd);
  if (!d) return "";
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

export function formatDuration(min) {
  if (!min) return "";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m} min`;
  if (!m) return h === 1 ? "1 hr" : `${h} hrs`;
  return `${h} hr ${m} min`;
}

/** Build start/end Date objects from the three lecture fields. */
export function lectureRange({ date, time, duration }) {
  if (!date || !time) return null;
  const d = fromYmd(date);
  const [h, m] = time.split(":").map(Number);
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m, 0, 0);
  const end = duration ? new Date(start.getTime() + duration * 60000) : null;
  return { start, end };
}

/** Convert minutes past midnight to "HH:MM". */
export function minutesToHhmm(total) {
  const t = ((total % 1440) + 1440) % 1440;
  return `${pad(Math.floor(t / 60))}:${pad(t % 60)}`;
}
