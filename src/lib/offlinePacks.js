/**
 * Offline UTME subject packs (website and installed web app).
 *
 * Saving a pack stores the subject file, its question pictures and the
 * control-room changes in Cache Storage. utmeBank falls back to that cache
 * when there's no connection, and the service worker serves the pictures.
 * In the Android app the whole bank already ships inside the app.
 */
import { isNativeApp } from "./platform";
import { API_BASE } from "./api";
import { imgUrl } from "./utmeBank";

const CACHE = "ac-utme-v1";
const BASE = (import.meta.env.VITE_UTME_BASE || "/utme").replace(/\/$/, "");
const META_KEY = "ac.utme.packs";

export const packsSupported = () => typeof caches !== "undefined" && typeof window !== "undefined";
export const bankBuiltIn = () => isNativeApp();

const readMeta = () => { try { return JSON.parse(localStorage.getItem(META_KEY) || "{}"); } catch { return {}; } };
const writeMeta = (m) => localStorage.setItem(META_KEY, JSON.stringify(m));
export const savedPacks = () => readMeta();

async function ensureWorker() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const existing = await navigator.serviceWorker.getRegistration("/");
    if (!existing) await navigator.serviceWorker.register("/firebase-messaging-sw.js");
  } catch { /* the pack still works for questions; pictures need the worker */ }
}

/** Pictures a subject file refers to. */
function picturesOf(subject) {
  const files = new Set();
  for (const q of subject.questions || []) {
    if (q.si?.[0]) files.add(q.si[0]);
    for (const p of q.oi || []) if (p?.[0]) files.add(p[0]);
  }
  return [...files].map((f) => imgUrl(subject.slug, f));
}

/** Download one subject. onProgress(done, total). Resolves to { bytes, files }. */
export async function savePack(slug, name, onProgress) {
  if (!packsSupported()) throw new Error("This browser can't save subjects for offline use.");
  await ensureWorker();
  const cache = await caches.open(CACHE);
  const subjectUrl = new URL(`${BASE}/${slug}.json`, window.location.href).href;
  const res = await fetch(subjectUrl, { cache: "reload" });
  if (!res.ok) throw new Error("Couldn't download this subject. Check your connection.");
  const copy = res.clone();
  const subject = await res.json();
  await cache.put(subjectUrl, copy);
  for (const extra of [new URL(`${BASE}/index.json`, window.location.href).href, `${API_BASE}/utme/patches`]) {
    try { const r = await fetch(extra, { cache: "reload" }); if (r.ok) await cache.put(extra, r); } catch { /* optional */ }
  }
  const pics = picturesOf(subject);
  let done = 0, bytes = Number(copy.headers.get("content-length")) || 0;
  onProgress?.(0, pics.length);
  const queue = [...pics];
  async function worker() {
    while (queue.length) {
      const url = queue.shift();
      try {
        const r = await fetch(url);
        if (r.ok) {
          const b = await r.clone().blob();
          bytes += b.size;
          await cache.put(url, r);
        }
      } catch { /* skip one missing picture */ }
      done++;
      onProgress?.(done, pics.length);
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()]);
  const meta = readMeta();
  meta[slug] = { name, savedAt: Date.now(), bytes, files: pics.length + 1, urls: [subjectUrl, ...pics] };
  writeMeta(meta);
  return meta[slug];
}

export async function removePack(slug) {
  const meta = readMeta();
  const entry = meta[slug];
  if (entry && packsSupported()) {
    const cache = await caches.open(CACHE);
    await Promise.all((entry.urls || []).map((u) => cache.delete(u)));
  }
  delete meta[slug];
  writeMeta(meta);
}

export const formatBytes = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
