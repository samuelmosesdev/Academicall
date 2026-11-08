/**
 * Small localStorage helpers for the reader.
 *  - per-document position (last page + zoom/fit) so a book reopens where it was left
 *  - global display prefs (reading theme, view mode, thumbnail sidebar)
 */

const DOC_PREFIX = "acad.reader.doc:";
const PREFS_KEY = "acad.reader.prefs";
const MAX_DOCS = 120;

function safeGet(key) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function safeSet(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked (private mode) — the reader still works, it just forgets.
  }
}

/** Stable key for a document: explicit id wins, otherwise the URL without its query (signed tokens change). */
export function readerDocKey(docKey, src) {
  if (docKey) return String(docKey);
  if (!src || String(src).startsWith("blob:")) return null;
  return String(src).split(/[?#]/, 1)[0];
}

export function loadDocState(key) {
  if (!key) return null;
  return safeGet(DOC_PREFIX + key);
}

export function saveDocState(key, state) {
  if (!key) return;
  safeSet(DOC_PREFIX + key, { ...state, at: Date.now() });
  pruneDocStates();
}

let pruneScheduled = false;
function pruneDocStates() {
  if (pruneScheduled) return;
  pruneScheduled = true;
  setTimeout(() => {
    pruneScheduled = false;
    try {
      const entries = [];
      for (let i = 0; i < window.localStorage.length; i += 1) {
        const key = window.localStorage.key(i);
        if (key?.startsWith(DOC_PREFIX)) entries.push([key, safeGet(key)?.at || 0]);
      }
      if (entries.length <= MAX_DOCS) return;
      entries
        .sort((a, b) => a[1] - b[1])
        .slice(0, entries.length - MAX_DOCS)
        .forEach(([key]) => window.localStorage.removeItem(key));
    } catch {
      // ignore
    }
  }, 2000);
}

const DEFAULT_PREFS = { theme: "light", mode: "continuous", sidebar: true };

export function loadReaderPrefs() {
  return { ...DEFAULT_PREFS, ...(safeGet(PREFS_KEY) || {}) };
}

export function saveReaderPrefs(prefs) {
  safeSet(PREFS_KEY, prefs);
}
