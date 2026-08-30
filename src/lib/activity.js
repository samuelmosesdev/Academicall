/**
 * Student activity helpers — daily streak + material opens.
 * Safe to call multiple times; uses localStorage to avoid double-counting
 * the same day / same document open in one session.
 */
import { doc, updateDoc, increment, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/config";
import { usersApi } from "./api";

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function yesterdayKey() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Call when the student opens the dashboard (or any main page).
 * - First activity today after yesterday → streak + 1
 * - First activity today after a gap → streak = 1
 * - Same day again → no change
 */
export async function recordDailyActivity(user, profile) {
  if (!user?.uid) return;
  const today = todayKey();
  const storageKey = `uofa_active_${user.uid}`;
  if (localStorage.getItem(storageKey) === today) return; // already counted today

  const last = profile?.lastActiveDate || null;
  let nextStreak = 1;
  if (last === today) {
    localStorage.setItem(storageKey, today);
    return;
  }
  if (last === yesterdayKey()) {
    nextStreak = (Number(profile?.studyStreakDays) || 0) + 1;
  }

  try {
    if (localStorage.getItem("academicall_token")) {
      await usersApi.updateMe({ lastActiveDate: today, studyStreakDays: nextStreak, lastActiveAt: new Date().toISOString() });
      localStorage.setItem(storageKey, today);
      return;
    }
    await updateDoc(doc(db, "users", user.uid), {
      lastActiveDate: today,
      studyStreakDays: nextStreak,
      lastActiveAt: serverTimestamp(),
    });
    localStorage.setItem(storageKey, today);
  } catch (e) {
    console.warn("recordDailyActivity:", e?.message || e);
  }
}

/**
 * Call when a student opens a material / document.
 * Increments materialsOpenedCount on the user and openCount on the document.
 */
export async function recordMaterialOpen(user, docId, profile = null) {
  if (!user?.uid || !docId) return;
  const sessionKey = `uofa_open_${user.uid}_${docId}`;
  if (sessionStorage.getItem(sessionKey)) return; // once per session per doc
  sessionStorage.setItem(sessionKey, "1");

  try {
    if (localStorage.getItem("academicall_token")) {
      await usersApi.updateMe({ materialsOpenedCount: Number(profile?.materialsOpenedCount || 0) + 1 });
      return;
    }
    await updateDoc(doc(db, "users", user.uid), {
      materialsOpenedCount: increment(1),
      lastActiveAt: serverTimestamp(),
    });
  } catch (e) {
    console.warn("recordMaterialOpen user:", e?.message || e);
  }

  // Best-effort: also bump document openCount (rules must allow it)
  try {
    if (docId && docId !== "external") {
      await updateDoc(doc(db, "documents", docId), {
        openCount: increment(1),
      });
    }
  } catch {
    /* ignore — rules or missing doc */
  }

}
