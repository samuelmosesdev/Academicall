import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  setDoc,
  updateDoc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import {
  api,
  announcementsApi,
  notificationsApi,
  STUDENT_NOTIFICATIONS_UPDATED_EVENT,
} from "../lib/api";
import { subscribe as subscribeRealtime } from "../lib/realtime";
import { matchesAcademicScope } from "../lib/academicScope";

/**
 * Student notifications = system notifications + published announcements
 * (filtered by audience). Read state for announcements is tracked per person in
 * announcement_reads; system notifications carry readByUser.
 *
 * In API mode every caller (the bell in the top bar, the notifications page…)
 * shares ONE store, so marking something read on the page updates the badge at
 * once and both always agree. The store re-fetches from the server after every
 * change, on window focus, and on the live "notification" stream event, so what
 * you see after a refresh is what the server has persisted.
 */

export function toMillis(ts) {
  if (!ts) return 0;
  if (typeof ts === "number") return ts;
  if (ts.seconds) return ts.seconds * 1000;
  const ms = new Date(ts).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

/* ---------------------------- shared API store ---------------------------- */

const EMPTY_STATE = {
  userId: null,
  systemNotifs: [],
  announcements: [],
  readMap: {},
  serverUnread: null, // true unread total for system notifications (not capped at 50)
  loading: true,
};

let state = EMPTY_STATE;
const subscribers = new Set();
let inFlight = null;
let rerun = false;
let teardown = null;

function setState(patch) {
  state = { ...state, ...(typeof patch === "function" ? patch(state) : patch) };
  subscribers.forEach((fn) => fn());
}

function load() {
  const userId = state.userId;
  if (!userId) return Promise.resolve();
  if (inFlight) {
    // A change landed while we were fetching: fetch once more afterwards so we
    // never keep a response that predates it.
    rerun = true;
    return inFlight;
  }
  inFlight = Promise.all([
    notificationsApi.list(),
    announcementsApi.list(),
    announcementsApi.listReads().catch(() => ({ reads: [] })),
  ])
    .then(([notificationData, announcementData, readData]) => {
      if (state.userId !== userId) return;
      const readMap = {};
      (readData.reads || []).forEach((item) => {
        if (item.announcementId) readMap[item.announcementId] = true;
      });
      (notificationData.readAnnouncementIds || []).forEach((id) => {
        readMap[id] = true;
      });
      setState({
        systemNotifs: (notificationData.notifications || []).map((item) => ({ ...item, _type: "system" })),
        announcements: (announcementData.announcements || []).map((item) => ({ ...item, _type: "announcement" })),
        readMap,
        serverUnread: typeof notificationData.unreadCount === "number" ? notificationData.unreadCount : null,
        loading: false,
      });
    })
    .catch(() => {
      if (state.userId === userId) setState({ loading: false });
    })
    .finally(() => {
      inFlight = null;
      if (rerun) {
        rerun = false;
        load();
      }
    });
  return inFlight;
}

function startListening() {
  if (teardown) return;
  const refresh = () => load();
  window.addEventListener(STUDENT_NOTIFICATIONS_UPDATED_EVENT, refresh);
  window.addEventListener("focus", refresh);
  const offNotif = subscribeRealtime("notification", refresh);
  const offReconnect = subscribeRealtime("reconnected", refresh);
  teardown = () => {
    window.removeEventListener(STUDENT_NOTIFICATIONS_UPDATED_EVENT, refresh);
    window.removeEventListener("focus", refresh);
    offNotif?.();
    offReconnect?.();
    teardown = null;
  };
}

function subscribeStore(fn) {
  subscribers.add(fn);
  startListening();
  return () => {
    subscribers.delete(fn);
    if (!subscribers.size) teardown?.();
  };
}

function ensureUser(userId) {
  if (state.userId === userId) return;
  state = { ...EMPTY_STATE, userId, loading: Boolean(userId) };
  subscribers.forEach((fn) => fn());
  if (userId) load();
}

const getSnapshot = () => state;

function announceChange() {
  window.dispatchEvent(new Event(STUDENT_NOTIFICATIONS_UPDATED_EVENT));
}

/* --------------------------------- hook --------------------------------- */

export function useStudentNotifications() {
  const { user, profile, authMode } = useAuth();
  const isApi = authMode === "api";
  const apiState = useSyncExternalStore(subscribeStore, getSnapshot, getSnapshot);

  // Firestore (legacy) mode keeps its own live listeners.
  const [fsSystem, setFsSystem] = useState([]);
  const [fsAnnouncements, setFsAnnouncements] = useState([]);
  const [fsReadMap, setFsReadMap] = useState({});
  const [fsLoading, setFsLoading] = useState(true);

  useEffect(() => {
    if (isApi) ensureUser(user?.uid || user?.id || null);
  }, [isApi, user?.uid, user?.id]);

  // System notifications for this user (Firestore mode)
  useEffect(() => {
    if (isApi || !user) return undefined;
    const q = query(
      collection(db, "notifications"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc"),
      limit(100)
    );
    return onSnapshot(q, (snap) => {
      setFsSystem(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data(), _type: "system" }))
          .filter((n) => !n.archived && !n.deleted)
      );
    });
  }, [user, isApi]);

  // Published announcements (Firestore mode)
  useEffect(() => {
    if (isApi) return undefined;
    const q = query(
      collection(db, "announcements"),
      where("published", "==", true),
      orderBy("createdAt", "desc"),
      limit(50)
    );
    return onSnapshot(
      q,
      (snap) => {
        setFsAnnouncements(snap.docs.map((d) => ({ id: d.id, ...d.data(), _type: "announcement" })));
        setFsLoading(false);
      },
      () => setFsLoading(false)
    );
  }, [isApi]);

  // Which announcements this student has already read (Firestore mode)
  useEffect(() => {
    if (isApi || !user) return undefined;
    const q = query(
      collection(db, "announcementReads"),
      where("userId", "==", user.uid),
      limit(200)
    );
    return onSnapshot(q, (snap) => {
      const map = {};
      snap.docs.forEach((d) => {
        const data = d.data();
        if (data.announcementId) map[data.announcementId] = true;
      });
      setFsReadMap(map);
    });
  }, [user, isApi]);

  const systemNotifs = isApi ? apiState.systemNotifs : fsSystem;
  const announcements = isApi ? apiState.announcements : fsAnnouncements;
  const readMap = isApi ? apiState.readMap : fsReadMap;
  const loading = isApi ? apiState.loading : fsLoading;

  // Filter announcements by audience + expiry
  const relevantAnnouncements = useMemo(() => {
    const now = Date.now();
    return announcements.filter((a) => {
      if (a.expiresAt && toMillis(a.expiresAt) < now) return false;
      if (a.audience === "faculty") return a.faculty && profile?.faculty === a.faculty;
      if (a.audience === "level") return a.level && profile?.level === a.level;
      if (a.audience === "department") return matchesAcademicScope(a.program || a.department, profile);
      return true; // all
    });
  }, [announcements, profile]);

  // Combined feed (newest first)
  const feed = useMemo(() => {
    const annItems = relevantAnnouncements.map((a) => ({
      ...a,
      _type: "announcement",
      _read: !!readMap[a.id],
      _sort: toMillis(a.createdAt),
    }));
    const sysItems = systemNotifs.map((n) => ({
      ...n,
      _type: "system",
      _read: n.readByUser === true,
      _sort: toMillis(n.createdAt),
    }));
    return [...annItems, ...sysItems].sort((a, b) => b._sort - a._sort);
  }, [relevantAnnouncements, systemNotifs, readMap]);

  const unreadCount = useMemo(() => {
    const unreadAnn = relevantAnnouncements.filter((a) => !readMap[a.id]).length;
    const localSys = systemNotifs.filter((n) => n.readByUser !== true).length;
    // The server count also covers unread items older than the 50 we list.
    const unreadSys = isApi && apiState.serverUnread != null ? Math.max(apiState.serverUnread, localSys) : localSys;
    return unreadAnn + unreadSys;
  }, [relevantAnnouncements, readMap, systemNotifs, isApi, apiState.serverUnread]);

  async function markAnnouncementRead(announcementId) {
    if (!user || readMap[announcementId]) return;
    if (isApi) {
      // Optimistic: drop the unread styling right away, then persist.
      setState((s) => ({ readMap: { ...s.readMap, [announcementId]: true } }));
      try {
        await announcementsApi.markRead(announcementId);
      } finally {
        announceChange();
      }
      return;
    }
    const id = `${user.uid}_${announcementId}`;
    await setDoc(doc(db, "announcementReads", id), {
      userId: user.uid,
      announcementId,
      readAt: serverTimestamp(),
    });
  }

  async function markSystemRead(notifId) {
    if (isApi) {
      const target = state.systemNotifs.find((item) => item.id === notifId);
      if (target && target.readByUser === true) return;
      setState((s) => ({
        systemNotifs: s.systemNotifs.map((item) => (item.id === notifId ? { ...item, readByUser: true } : item)),
        serverUnread: s.serverUnread != null && target ? Math.max(0, s.serverUnread - 1) : s.serverUnread,
      }));
      try {
        await notificationsApi.markRead(notifId);
      } finally {
        announceChange();
      }
      return;
    }
    await updateDoc(doc(db, "notifications", notifId), {
      readByUser: true,
      readAt: serverTimestamp(),
    });
  }

  async function markAllRead() {
    if (!user) return;
    if (isApi) {
      const announcementIds = relevantAnnouncements.filter((a) => !readMap[a.id]).map((a) => a.id);
      setState((s) => ({
        systemNotifs: s.systemNotifs.map((item) => ({ ...item, readByUser: true })),
        readMap: { ...s.readMap, ...Object.fromEntries(announcementIds.map((id) => [id, true])) },
        serverUnread: 0,
      }));
      try {
        // One call persists both: every system notification (not just the 50
        // listed) and the announcement reads, which used to be local-only and
        // came back as unread after a refresh.
        await api("/notifications/all/read", { method: "PATCH", body: { announcementIds } });
      } catch {
        await Promise.all([
          ...state.systemNotifs.map((item) => notificationsApi.markRead(item.id).catch(() => {})),
          ...announcementIds.map((id) => announcementsApi.markRead(id).catch(() => {})),
        ]);
      } finally {
        announceChange();
      }
      return;
    }
    const batch = writeBatch(db);
    relevantAnnouncements.forEach((a) => {
      if (!readMap[a.id]) {
        batch.set(doc(db, "announcementReads", `${user.uid}_${a.id}`), {
          userId: user.uid,
          announcementId: a.id,
          readAt: serverTimestamp(),
        });
      }
    });
    systemNotifs.forEach((n) => {
      if (!n.readByUser) {
        batch.update(doc(db, "notifications", n.id), { readByUser: true, readAt: serverTimestamp() });
      }
    });
    await batch.commit();
  }

  /** Drop an item locally after archive / delete so it leaves the list at once. */
  function removeLocal(notifId) {
    if (isApi) {
      setState((s) => {
        const target = s.systemNotifs.find((item) => item.id === notifId);
        return {
          systemNotifs: s.systemNotifs.filter((item) => item.id !== notifId),
          serverUnread:
            s.serverUnread != null && target && target.readByUser !== true ? Math.max(0, s.serverUnread - 1) : s.serverUnread,
        };
      });
    } else {
      setFsSystem((items) => items.filter((item) => item.id !== notifId));
    }
  }

  return {
    feed,
    announcements: relevantAnnouncements,
    systemNotifs,
    unreadCount,
    loading,
    markAnnouncementRead,
    markSystemRead,
    markAllRead,
    removeLocal,
    refresh: load,
    readMap,
  };
}
