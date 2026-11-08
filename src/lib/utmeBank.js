/**
 * UTME CBT question bank + session helpers.
 *
 * The bank is static: public/utme/index.json lists subjects, and each subject
 * lives in public/utme/<slug>.json (topics, years, passages, questions).
 * Questions whose maths, tables or diagrams can't be shown as plain text carry
 * pre-cropped pictures in public/utme/img/<slug>/ (diagrams are watermarked).
 *
 * Question shape (compact keys keep the files small):
 *   id  "topic-number"      t  topic index        y  exam year
 *   s   stem (markdown **bold**)                   si [file, w, h] stem picture
 *   o   option texts                               oi [[file, w, h] | null] option pictures
 *   a   correct option index                       k  official key when our review differs
 *   e   explanation                                p  passage id     block 1 = whole question is a picture
 */
import { api, API_BASE } from "./api";

const BASE = (import.meta.env.VITE_UTME_BASE || "/utme").replace(/\/$/, "");
const cache = new Map();

export const ENGLISH = "use-of-english";
/** JAMB UTME: English 60, every other subject 40; 180 questions in 2 hours. */
export const JAMB_COUNT = (slug) => (slug === ENGLISH ? 60 : 40);
export const JAMB_SECONDS_PER_QUESTION = 7200 / 180;

export function imgUrl(slug, file) {
  if (/^https?:\/\//.test(file)) return file;
  // pictures uploaded in the UTME control room live on the API
  if (file.startsWith("/utme/media/")) return `${API_BASE}${file}`;
  return `${BASE}/img/${slug}/${file}`;
}

// ── control-room changes, layered on the shipped bank ───────────────────────
let patchesPromise = null;
/** Every change made in the UTME control room: { items: [{ slug, qid, status, isNew, data }] }. */
export function loadPatches(force = false) {
  if (!patchesPromise || force) {
    patchesPromise = fetch(`${API_BASE}/utme/patches`)
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .catch(async () => {
        try {
          const hit = typeof caches !== "undefined" ? await caches.match(`${API_BASE}/utme/patches`) : null;
          if (hit) return hit.json();
        } catch { /* ignore */ }
        return { items: [] };
      });
  }
  return patchesPromise;
}

/** Turn a stored change into a bank question, adding its topic/passage to the subject when new. */
function toBankQuestion(qid, data, subject) {
  const q = { ...data, id: qid };
  if (data.tn) {
    let i = subject.topics.indexOf(data.tn);
    if (i < 0) { subject.topics.push(data.tn); i = subject.topics.length - 1; }
    q.t = i;
    delete q.tn;
  }
  if (data.pt) {
    const pid = `x:${qid}`;
    subject.passages[pid] = { y: data.y, h: data.ph || "", b: String(data.pt).split(/\n{2,}/).map((x) => x.trim()).filter(Boolean) };
    q.p = pid;
    delete q.pt;
    delete q.ph;
  }
  if (q.t == null) q.t = 0;
  return q;
}

/** Apply control-room changes to one subject (returns a new object). */
export function applyPatches(base, items = []) {
  const mine = items.filter((p) => p.slug === base.slug);
  if (!mine.length) return base;
  const subject = { ...base, topics: [...base.topics], years: [...base.years], passages: { ...(base.passages || {}) } };
  const byId = new Map(mine.map((p) => [p.qid, p]));
  const questions = [];
  for (const q of base.questions) {
    const p = byId.get(q.id);
    if (!p) { questions.push(q); continue; }
    if (p.status === "removed") continue;
    questions.push(p.data ? toBankQuestion(q.id, p.data, subject) : q);
  }
  for (const p of mine) if (p.isNew && p.status !== "removed" && p.data) questions.push(toBankQuestion(p.qid, p.data, subject));
  const years = new Set(subject.years);
  for (const q of questions) if (q.y) years.add(q.y);
  subject.years = [...years].sort((a, b) => a - b);
  subject.questions = questions;
  subject.count = questions.length;
  return subject;
}

function fetchJson(url, msg) {
  return fetch(url)
    .then((r) => {
      if (!r.ok) throw new Error(msg);
      return r.json();
    })
    .catch(async (err) => {
      // Offline: use a subject pack saved from the Downloads page, if there is one.
      try {
        const hit = typeof caches !== "undefined" ? await caches.match(new URL(url, window.location.href).href) : null;
        if (hit) return hit.json();
      } catch { /* no cache storage */ }
      throw err;
    });
}

export async function loadIndex() {
  if (cache.has("index")) return cache.get("index");
  const p = Promise.all([
    fetchJson(`${BASE}/index.json`, "The question bank couldn't load. Check your connection and try again."),
    loadPatches(),
  ]).then(([index, { items = [] }]) => {
    if (!items.length) return index;
    const delta = {};
    for (const it of items) {
      const d = (delta[it.slug] ||= { n: 0, years: {} });
      if (it.isNew && it.status !== "removed") { d.n += 1; if (it.data?.y) d.years[it.data.y] = (d.years[it.data.y] || 0) + 1; }
      if (!it.isNew && it.status === "removed") d.n -= 1;
    }
    return {
      ...index,
      subjects: index.subjects.map((s) => {
        const d = delta[s.slug];
        if (!d) return s;
        const yearCounts = { ...(s.yearCounts || {}) };
        for (const [y, n] of Object.entries(d.years)) yearCounts[y] = (yearCounts[y] || 0) + n;
        const years = [...new Set([...(s.years || []), ...Object.keys(d.years).map(Number)])].sort((a, b) => a - b);
        return { ...s, count: Math.max(0, s.count + d.n), yearCounts, years };
      }),
    };
  });
  cache.set("index", p);
  p.catch(() => cache.delete("index"));
  return p;
}

/** The subject exactly as shipped (the control room compares against this). */
export async function loadSubjectRaw(slug) {
  const key = `raw:${slug}`;
  if (cache.has(key)) return cache.get(key);
  const p = fetchJson(`${BASE}/${slug}.json`, "This subject couldn't load. Check your connection and try again.");
  cache.set(key, p);
  p.catch(() => cache.delete(key));
  return p;
}

/** The subject with control-room changes applied: what candidates practise on. */
export async function loadSubject(slug) {
  if (cache.has(slug)) return cache.get(slug);
  const p = Promise.all([loadSubjectRaw(slug), loadPatches()]).then(([base, { items = [] }]) => applyPatches(base, items));
  cache.set(slug, p);
  p.catch(() => cache.delete(slug));
  return p;
}

/** Forget cached subjects so the next load picks up fresh changes. */
export function resetBankCache() {
  for (const k of [...cache.keys()]) if (!k.startsWith("raw:")) cache.delete(k);
  patchesPromise = null;
}

// ── control room (admins and staff with utme.manage) ────────────────────────
export const utmeAdminApi = {
  summary: () => api("/admin/utme/summary"),
  patches: (slug) => api(`/admin/utme/patches${slug ? `?slug=${encodeURIComponent(slug)}` : ""}`),
  team: () => api("/admin/utme/team"),
  save: (slug, qid, data, note) => api(`/admin/utme/questions/${slug}/${qid}`, { method: "PUT", body: JSON.stringify({ data, note }) }),
  add: (slug, data, note) => api(`/admin/utme/questions/${slug}`, { method: "POST", body: JSON.stringify({ data, note }) }),
  bulk: (slug, items, skipInvalid = false) => api(`/admin/utme/questions/${slug}/bulk`, { method: "POST", body: JSON.stringify({ items, skipInvalid }) }),
  remove: (slug, qid, note) => api(`/admin/utme/questions/${slug}/${qid}`, { method: "DELETE", body: JSON.stringify({ note }) }),
  restore: (slug, qid) => api(`/admin/utme/questions/${slug}/${qid}/restore`, { method: "POST" }),
  revert: (slug, qid) => api(`/admin/utme/questions/${slug}/${qid}/revert`, { method: "POST" }),
  async upload(file, slug) {
    const res = await fetch(`${API_BASE}/admin/utme/media${slug ? `?slug=${encodeURIComponent(slug)}` : ""}`, {
      method: "POST",
      headers: { "Content-Type": file.type || "application/octet-stream", Authorization: `Bearer ${localStorage.getItem("academicall_token") || ""}` },
      body: file,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "The picture didn't upload. Try again.");
    return data;
  },
};

function shuffle(arr, rnd = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Keep passage questions together and in order, so comprehension reads properly. */
function groupByPassage(list) {
  const groups = [];
  const byPassage = new Map();
  for (const q of list) {
    if (q.p == null) { groups.push([q]); continue; }
    if (!byPassage.has(q.p)) { const g = []; byPassage.set(q.p, g); groups.push(g); }
    byPassage.get(q.p).push(q);
  }
  return groups;
}

/**
 * Pick questions for one subject.
 *  mode "topic": only the chosen topics (all topics when none chosen), shuffled
 *  mode "year":  one exam year, in paper order (topic order inside the year)
 *  mode "mixed": anything in the subject, shuffled
 */
export function pickQuestions(subject, { mode, topics = [], year, count, shuffleOptions = false }) {
  let pool = subject.questions;
  if (mode === "topic" && topics.length) {
    const set = new Set(topics.map(Number));
    pool = pool.filter((q) => set.has(q.t));
  }
  if (mode === "year" && year) pool = pool.filter((q) => q.y === Number(year));
  let picked;
  if (mode === "year") {
    picked = pool.slice(0, count || pool.length);
  } else {
    const groups = shuffle(groupByPassage(pool));
    picked = [];
    for (const g of groups) {
      if (picked.length >= count) break;
      // take a whole passage set when it fits; otherwise take what still fits
      picked.push(...g.slice(0, Math.max(0, count - picked.length)));
    }
  }
  return picked.map((q) => {
    const item = { ...q, slug: subject.slug, key: `${subject.slug}:${q.id}` };
    if (shuffleOptions && !q.block && !q.oi && q.o.length >= 2 && !q.o.some(looksPositional)) {
      const order = shuffle(q.o.map((_, i) => i));
      item.o = order.map((i) => q.o[i]);
      item.a = order.indexOf(q.a);
      if (q.k != null) item.k = order.indexOf(q.k);
    }
    return item;
  });
}

/** "All of the above" style options must keep their place. */
function looksPositional(text) {
  return /\b(all|none|both) of the (above|options|foregoing)\b|^(a|b|c|d) and (b|c|d|e)\b|\babove\b/i.test(text || "");
}

export function scoreSession(session, answers) {
  const per = session.subjects.map((s) => {
    const qs = session.questions.filter((q) => q.slug === s.slug);
    const correct = qs.filter((q) => answers[q.key] === q.a).length;
    return { slug: s.slug, name: s.name, total: qs.length, correct, score: qs.length ? Math.round((correct / qs.length) * 100) : 0 };
  });
  const total = per.reduce((n, s) => n + s.total, 0);
  const correct = per.reduce((n, s) => n + s.correct, 0);
  return { per, total, correct, score: per.reduce((n, s) => n + s.score, 0), maxScore: per.length * 100 };
}

export function formatClock(sec) {
  if (sec == null) return "--:--";
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}` : `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

// ── in-progress session (survives a refresh) ────────────────────────────────
const LIVE_KEY = "ac.utme.live";
export const liveSession = {
  get() {
    try { return JSON.parse(sessionStorage.getItem(LIVE_KEY) || "null"); } catch { return null; }
  },
  set(v) {
    try { sessionStorage.setItem(LIVE_KEY, JSON.stringify(v)); } catch { /* storage full: keep going in memory */ }
  },
  clear() { sessionStorage.removeItem(LIVE_KEY); },
};

// ── history (API, with a local fallback when offline) ───────────────────────
const LOCAL_KEY = "ac.utme.history";
function localHistory() {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]"); } catch { return []; }
}

// Sessions finished without a connection wait here and are sent when you're back online.
const QUEUE_KEY = "ac.utme.queue";
const queue = () => { try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]"); } catch { return []; } };
let flushing = null;
export function pendingSyncCount() { return queue().length; }
export async function flushUtmeQueue() {
  if (flushing) return flushing;
  flushing = (async () => {
    let left = queue();
    let sent = 0;
    for (const item of [...left]) {
      try {
        await api("/utme/attempts", { method: "POST", body: JSON.stringify(item.body) });
        left = left.filter((x) => x.qid !== item.qid);
        localStorage.setItem(QUEUE_KEY, JSON.stringify(left));
        localStorage.setItem(LOCAL_KEY, JSON.stringify(localHistory().filter((r) => r.id !== item.qid)));
        sent++;
      } catch (e) {
        if (e.status && e.status >= 400 && e.status < 500) { left = left.filter((x) => x.qid !== item.qid); localStorage.setItem(QUEUE_KEY, JSON.stringify(left)); }
        else break;
      }
    }
    return sent;
  })().finally(() => { flushing = null; });
  return flushing;
}
if (typeof window !== "undefined") window.addEventListener("online", () => { flushUtmeQueue().catch(() => {}); });

export const utmeApi = {
  async list() {
    try {
      if (queue().length) await flushUtmeQueue().catch(() => {});
      return await api("/utme/attempts?pageSize=30");
    } catch (e) {
      const items = localHistory();
      return { items, total: items.length, stats: null, offline: true, error: e.message };
    }
  },
  async save(body) {
    try {
      return await api("/utme/attempts", { method: "POST", body: JSON.stringify(body) });
    } catch (e) {
      const row = { ...body, id: `local-${Date.now()}`, createdAt: new Date().toISOString(), local: true,
        total: body.subjects.reduce((n, s) => n + s.total, 0), correct: body.subjects.reduce((n, s) => n + s.correct, 0),
        score: body.subjects.reduce((n, s) => n + s.score, 0), maxScore: body.subjects.length * 100 };
      delete row.answers;
      localStorage.setItem(LOCAL_KEY, JSON.stringify([row, ...localHistory()].slice(0, 30)));
      if (!e.status || e.status >= 500) localStorage.setItem(QUEUE_KEY, JSON.stringify([...queue(), { qid: row.id, body }].slice(-30)));
      return row;
    }
  },
  remove(id) {
    if (String(id).startsWith("local-")) {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(localHistory().filter((r) => r.id !== id)));
      return Promise.resolve({ ok: true });
    }
    return api(`/utme/attempts/${id}`, { method: "DELETE" });
  },
};
