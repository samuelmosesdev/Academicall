import { useEffect, useSyncExternalStore } from "react";
import { Link, useLocation } from "react-router-dom";
import { BellPlus, BellRing, Check } from "lucide-react";
import { newsApi } from "../../lib/newsApi";
import { notify } from "../../lib/dialogs";
import { useAuth } from "../../context/AuthContext";

// One shared list of what the reader follows, so every Follow button stays in sync.
let state = { loaded: false, loading: false, subscriptions: [], newsAlerts: true, suggestions: null };
const subs = new Set();
const emit = () => subs.forEach((fn) => fn());
const set = (patch) => { state = { ...state, ...patch }; emit(); };

export async function loadFollows(force = false) {
  if ((state.loaded || state.loading) && !force) return;
  set({ loading: true });
  try {
    const r = await newsApi.subscriptions();
    set({ loaded: true, loading: false, subscriptions: r.subscriptions || [], newsAlerts: r.newsAlerts, suggestions: r.suggestions });
  } catch { set({ loading: false }); }
}
export function resetFollows() { state = { loaded: false, loading: false, subscriptions: [], newsAlerts: true, suggestions: null }; emit(); }

export function useFollows() {
  const { user } = useAuth();
  const snap = useSyncExternalStore((fn) => { subs.add(fn); return () => subs.delete(fn); }, () => state);
  useEffect(() => { if (user) loadFollows(); else if (state.loaded) resetFollows(); }, [user]);
  const find = (kind, value) => snap.subscriptions.find((s) => s.kind === kind && s.value === (kind === "topic" ? String(value).toLowerCase() : value));
  async function toggle(kind, value, label) {
    const hit = find(kind, value);
    try {
      if (hit) {
        set({ subscriptions: state.subscriptions.filter((s) => s.id !== hit.id) });
        await newsApi.unfollow(hit.id);
      } else {
        const r = await newsApi.follow(kind, value, label);
        set({ subscriptions: [...state.subscriptions.filter((s) => s.id !== r.subscription.id), r.subscription] });
        notify.success(`Following ${label || value}. New stories reach you as they drop.`);
      }
    } catch (e) { notify.error(e.message); loadFollows(true); }
  }
  async function setAlerts(on) {
    set({ newsAlerts: on });
    try { await newsApi.alerts(on); } catch (e) { notify.error(e.message); set({ newsAlerts: !on }); }
  }
  return { ...snap, find, toggle, setAlerts, signedIn: !!user };
}

/** Follow a section, topic, writer or institution. Signed-out readers are asked to sign in. */
export function FollowButton({ kind, value, label, size = "md", className = "" }) {
  const f = useFollows();
  const location = useLocation();
  const on = !!f.find(kind, value);
  const cls = size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm";
  if (!f.signedIn) {
    return <Link to="/login" state={{ from: location }} className={`news-follow ${cls} ${className}`}><BellPlus size={size === "sm" ? 13 : 15} /> Follow{label ? ` ${label}` : ""}</Link>;
  }
  return (
    <button type="button" onClick={() => f.toggle(kind, value, label)} aria-pressed={on} className={`news-follow ${on ? "is-on" : ""} ${cls} ${className}`}>
      {on ? <><Check size={size === "sm" ? 13 : 15} /> Following{label ? ` ${label}` : ""}</> : <><BellPlus size={size === "sm" ? 13 : 15} /> Follow{label ? ` ${label}` : ""}</>}
    </button>
  );
}

export function FollowingCount() {
  const f = useFollows();
  if (!f.signedIn) return null;
  return (
    <Link to="/news/following" className="inline-flex items-center gap-1.5 rounded-full border border-border-light bg-card-light px-3.5 py-2 text-sm font-medium text-ink hover:border-violet">
      <BellRing size={15} className="text-violet" /> Following {f.subscriptions.length ? <span className="rounded-full bg-violet px-1.5 text-xs text-white">{f.subscriptions.length}</span> : null}
    </Link>
  );
}
