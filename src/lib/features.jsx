/**
 * Feature switches (web side).
 *
 * The admin can discontinue a feature from Admin → Features. A switched-off
 * feature disappears for students and aspirants: its menu items and dashboard
 * links are hidden, and its pages send people to an available fallback. The API
 * blocks it too (see Academicall-api/src/lib/features.ts). Staff consoles keep
 * their management pages so content can still be looked after.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { api, API_BASE } from "./api";
import { useAuth } from "../context/AuthContext";
import { isStaff } from "./roles";

/** Pages that belong to each feature (path prefixes in the web app). */
export const FEATURE_PAGES = {
  courses: ["/dashboard/courses"],
  programme: ["/dashboard/department"],
  groups: ["/dashboard/groups", "/study/"],
  materials: ["/dashboard/materials", "/materials/"],
  readingHub: ["/dashboard/reading-hub"],
  reference: ["/dashboard/reference"],
  timetable: ["/dashboard/timetable"],
  courseRep: ["/dashboard/course-rep"],
  practice: ["/dashboard/practice"],
  utme: ["/dashboard/utme", "/utme/"],
  aspirantHouse: ["/dashboard/house", "/house-desk"],
  choices: ["/dashboard/choices"],
  news: ["/news"],
  vault: ["/dashboard/vault"],
  upgrade: ["/dashboard/upgrade"],
  secretariat: ["/secretariat"],
  results: ["/dashboard/results"],
  downloads: ["/dashboard/downloads"],
  tests: ["/dashboard/tests", "/test/"],
  search: ["/dashboard/search"],
};

const CACHE_KEY = "ac.features.off";
const readCache = () => {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || "[]"); } catch { return []; }
};

const FeaturesContext = createContext({ off: [], ready: false, isOn: () => true, reload: () => {}, maintenance: { on: false }, banner: null });

export function FeaturesProvider({ children }) {
  const [off, setOff] = useState(readCache);
  const [ready, setReady] = useState(false);
  const [maintenance, setMaintenance] = useState({ on: false });
  const [banner, setBanner] = useState(null);

  const reload = useCallback(async () => {
    try {
      // Send the token so features limited to an audience (beta testers, an institution) open for the right people.
      const token = localStorage.getItem("academicall_token");
      const res = await fetch(`${API_BASE}/features`, { cache: "no-store", headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      const list = Array.isArray(data.off) ? data.off : [];
      setOff(list);
      setMaintenance(data.maintenance || { on: false });
      setBanner(data.banner || null);
      localStorage.setItem(CACHE_KEY, JSON.stringify(list));
    } catch { /* offline: keep the last known list */ }
    setReady(true);
  }, []);

  useEffect(() => {
    reload();
    const onFocus = () => reload();
    const onMaintenance = (e) => setMaintenance({ on: true, message: e.detail?.error, until: e.detail?.until });
    window.addEventListener("focus", onFocus);
    window.addEventListener("ac:maintenance", onMaintenance);
    window.addEventListener("ac:signed-in", onFocus);
    const t = setInterval(reload, 5 * 60_000);
    return () => { window.removeEventListener("focus", onFocus); window.removeEventListener("ac:maintenance", onMaintenance); window.removeEventListener("ac:signed-in", onFocus); clearInterval(t); };
  }, [reload]);

  const value = useMemo(() => {
    const set = new Set(off);
    return { off, ready, reload, maintenance, banner, isOn: (key) => !key || !set.has(key) };
  }, [off, ready, reload, maintenance, banner]);
  return <FeaturesContext.Provider value={value}>{children}</FeaturesContext.Provider>;
}

export const useFeatures = () => useContext(FeaturesContext);

/** Which feature owns this path, if any. */
export function featureForPath(path) {
  let best = null;
  for (const [key, prefixes] of Object.entries(FEATURE_PAGES)) {
    for (const p of prefixes) {
      const base = p.replace(/\/$/, "");
      const hit = path === base || path.startsWith(`${base}/`);
      if (hit && (!best || base.length > best.len)) best = { key, len: base.length };
    }
  }
  return best?.key || null;
}

/**
 * Sends people away from the pages of a switched-off feature. Staff (admins
 * and agents) keep access so they can look after the content behind it.
 */
export function FeatureRedirect() {
  const { pathname } = useLocation();
  const { isOn } = useFeatures();
  const { profile, user, loading } = useAuth();
  const key = featureForPath(pathname);
  if (!key || isOn(key) || loading || isStaff(profile)) return null;
  const fallback = key === "readingHub" && isOn("materials")
    ? "/dashboard/materials"
    : user
      ? "/dashboard"
      : "/";
  return <Navigate to={fallback} replace />;
}

/** Admin switchboard calls. */
export const featuresAdminApi = {
  list: () => api("/admin/features"),
  set: (key, enabled, note) => api(`/admin/features/${key}`, { method: "PUT", body: JSON.stringify({ enabled, note }) }),
};

/** Pro or free, per feature (admins, and staff holding "features.pro"). */
export const proFeaturesApi = {
  list: () => api("/admin/pro-features"),
  set: (key, pro) => api(`/admin/pro-features/${key}`, { method: "PUT", body: { pro } }),
};

/**
 * Maintenance mode: everyone but staff sees this instead of the app.
 * The sign-in page stays reachable so staff can get in.
 */
export function MaintenanceScreen() {
  const { maintenance, reload } = useFeatures();
  const { profile, loading } = useAuth();
  const { pathname } = useLocation();
  if (!maintenance?.on || loading || isStaff(profile) || pathname.startsWith("/login")) return null;
  const until = maintenance.until ? new Date(maintenance.until).toLocaleString("en-GB", { timeZone: "Africa/Lagos", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : null;
  return (
    <div className="maint" role="alert">
      <div className="maint-card">
        <p className="maint-brand">Academicall</p>
        <h1>Back soon.</h1>
        <p>{maintenance.message || "We're updating Academicall. Your work is safe."}</p>
        {until && <p className="maint-until">Expected back by {until} (Lagos time).</p>}
        <button type="button" className="ctl-btn" onClick={reload}>Try again</button>
      </div>
    </div>
  );
}

/** The site-wide banner an admin sets (Admin → Features). Dismissed per message on this device. */
export function SiteBanner() {
  const { banner } = useFeatures();
  const id = banner ? `${banner.at || ""}:${banner.text}` : "";
  const [hidden, setHidden] = useState(() => {
    try { return localStorage.getItem("ac.banner.hidden") || ""; } catch { return ""; }
  });
  if (!banner?.text || hidden === id) return null;
  const internal = banner.linkUrl?.startsWith("/");
  return (
    <div className={`site-banner is-${banner.tone || "info"}`} role="status">
      <p>{banner.text}</p>
      {banner.linkUrl && (internal
        ? <a href={banner.linkUrl}>{banner.linkLabel || "Open"}</a>
        : <a href={banner.linkUrl} target="_blank" rel="noreferrer">{banner.linkLabel || "Open"}</a>)}
      <button type="button" aria-label="Dismiss" onClick={() => { localStorage.setItem("ac.banner.hidden", id); setHidden(id); }}>×</button>
    </div>
  );
}
