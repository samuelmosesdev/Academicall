/**
 * Practice history is stored in the account and cached locally for instant/offline use.
 */
import { api } from "../../lib/api";

const KEY = (userId) => `academicall:cbt:${userId || "guest"}`;
const MAX_ATTEMPTS = 40;
const MAX_SEEN_PER_COURSE = 3000;

const signedIn = () => {
  try { return Boolean(localStorage.getItem("academicall_token")); } catch { return false; }
};

const newClientId = () =>
  (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);

const legacyId = (attempt) => `legacy-${String(attempt.at || "")}-${attempt.courseCode || ""}-${attempt.correct}-${attempt.total}`.slice(0, 64);

function read(userId) {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY(userId)) || "{}");
    return {
      attempts: Array.isArray(raw.attempts) ? raw.attempts : [],
      seen: raw.seen && typeof raw.seen === "object" ? raw.seen : {},
      pending: Array.isArray(raw.pending) ? raw.pending : [],
      imported: Boolean(raw.imported),
    };
  } catch {
    return { attempts: [], seen: {}, pending: [], imported: false };
  }
}

function write(userId, data) {
  try { localStorage.setItem(KEY(userId), JSON.stringify(data)); } catch { /* storage full or blocked */ }
}

export function loadHistory(userId) {
  const data = read(userId);
  return { attempts: data.attempts, seen: data.seen };
}

export async function syncHistory(userId) {
  if (!userId || !signedIn()) return loadHistory(userId);
  let data = read(userId);
  try {
    if (!data.imported && (data.attempts.length || Object.keys(data.seen).length)) {
      await api("/practice/history/import", {
        method: "POST",
        body: {
          attempts: data.attempts.slice(0, MAX_ATTEMPTS).map((attempt) => ({
            clientId: attempt.clientId || legacyId(attempt),
            courseCode: attempt.courseCode || null,
            courseTitle: attempt.courseTitle || null,
            mode: attempt.mode || null,
            quiz: Boolean(attempt.quiz),
            correct: attempt.correct | 0,
            total: attempt.total | 0,
            pct: Math.max(0, Math.min(100, attempt.pct | 0)),
            durationSec: attempt.durationSec ?? null,
            at: attempt.at,
          })).filter((attempt) => attempt.correct <= attempt.total),
          seen: data.seen,
        },
      });
      data.imported = true;
      data.pending = [];
      write(userId, data);
    }

    for (const item of data.pending) {
      await api("/practice/attempts", { method: "POST", body: item });
      data = read(userId);
      data.pending = data.pending.filter((pending) => pending.clientId !== item.clientId);
      write(userId, data);
    }

    const server = await api("/practice/history");
    data = read(userId);
    const queued = data.pending.map((item) => ({ ...item, at: item.at || new Date().toISOString() }));
    const seen = { ...(server.seen || {}) };
    for (const item of data.pending) {
      if (item.courseCode && item.questionIds?.length) {
        seen[item.courseCode] = Array.from(new Set([...(seen[item.courseCode] || []), ...item.questionIds])).slice(-MAX_SEEN_PER_COURSE);
      }
    }
    const next = { ...data, imported: true, attempts: [...queued, ...(server.attempts || [])].slice(0, MAX_ATTEMPTS), seen };
    write(userId, next);
    return { attempts: next.attempts, seen: next.seen };
  } catch {
    const current = read(userId);
    return { attempts: current.attempts, seen: current.seen };
  }
}

/** Save one finished session and mark its questions as seen. Returns the new history. */
export function recordAttempt(userId, attempt, questionIds = [], onSynced) {
  const data = read(userId);
  const clientId = newClientId();
  const at = new Date().toISOString();
  data.attempts = [{ ...attempt, clientId, at }, ...data.attempts].slice(0, MAX_ATTEMPTS);
  if (attempt.courseCode && questionIds.length) {
    const prior = new Set(data.seen[attempt.courseCode] || []);
    questionIds.forEach((id) => prior.add(id));
    data.seen[attempt.courseCode] = Array.from(prior).slice(-MAX_SEEN_PER_COURSE);
  }
  if (userId && signedIn()) {
    data.pending = [...data.pending, {
      clientId,
      courseCode: attempt.courseCode || null,
      courseTitle: attempt.courseTitle || null,
      mode: attempt.mode || null,
      quiz: Boolean(attempt.quiz),
      correct: attempt.correct | 0,
      total: attempt.total | 0,
      pct: attempt.pct | 0,
      durationSec: attempt.durationSec ?? null,
      questionIds: questionIds.slice(0, 500),
      at,
    }];
  }
  write(userId, data);
  if (userId && signedIn()) syncHistory(userId).then((history) => onSynced?.(history)).catch(() => {});
  return { attempts: data.attempts, seen: data.seen };
}

/** Per-course summary: questions seen, sessions, best and last score. */
export function courseProgress(history, courseCode, bankIds) {
  const seenIds = history.seen[courseCode] || [];
  const seen = bankIds ? seenIds.filter((id) => bankIds.has(id)).length : seenIds.length;
  const runs = history.attempts.filter((a) => a.courseCode === courseCode);
  return {
    seen,
    sessions: runs.length,
    best: runs.length ? Math.max(...runs.map((a) => a.pct)) : null,
    last: runs[0]?.pct ?? null,
  };
}
