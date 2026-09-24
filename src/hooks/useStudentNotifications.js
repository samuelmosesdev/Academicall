import { useEffect, useMemo, useState } from "react";
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
import { announcementsApi, notificationsApi } from "../lib/api";

/**
 * Student notifications = system notifications + published announcements
 * (filtered by audience). Read state for announcements is tracked in
 * announcementReads/{uid_announcementId}.
 */
export function useStudentNotifications() {
  const { user, profile, authMode } = useAuth();
  const [systemNotifs, setSystemNotifs] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [readMap, setReadMap] = useState({}); // { [announcementId]: true }
  const [loading, setLoading] = useState(true);

  // System notifications for this user
  useEffect(() => {
    if (authMode === "api") {
      let alive = true;
      Promise.all([notificationsApi.list(), announcementsApi.list(), announcementsApi.listReads()]).then(([notificationData, announcementData, readData]) => {
        if (!alive) return;
        setSystemNotifs((notificationData.notifications || []).map((item) => ({ ...item, _type: "system" })));
        setAnnouncements((announcementData.announcements || []).map((item) => ({ ...item, _type: "announcement" })));
        setReadMap(Object.fromEntries((readData.reads || []).filter((item) => item.announcementId).map((item) => [item.announcementId, true])));
        setLoading(false);
      }).catch(() => alive && setLoading(false));
      return () => { alive = false; };
    }
    if (!user) return;
    const q = query(
      collection(db, "notifications"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc"),
      limit(100)
    );
    const unsub = onSnapshot(q, (snap) => {
      setSystemNotifs(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data(), _type: "system" }))
          .filter((n) => !n.archived && !n.deleted)
      );
    });
    return unsub;
  }, [user, authMode]);

  // Published announcements
  useEffect(() => {
    if (authMode === "api") return;
    const q = query(
      collection(db, "announcements"),
      where("published", "==", true),
      orderBy("createdAt", "desc"),
      limit(50)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setAnnouncements(snap.docs.map((d) => ({ id: d.id, ...d.data(), _type: "announcement" })));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, [authMode]);

  // Which announcements this student has already read
  useEffect(() => {
    if (authMode === "api") return;
    if (!user) return;
    // Grows by one doc per announcement per user forever, so it must be capped.
    const q = query(
      collection(db, "announcementReads"),
      where("userId", "==", user.uid),
      limit(200)
    );
    const unsub = onSnapshot(q, (snap) => {
      const map = {};
      snap.docs.forEach((d) => {
        const data = d.data();
        if (data.announcementId) map[data.announcementId] = true;
      });
      setReadMap(map);
    });
    return unsub;
  }, [user, authMode]);

  // Filter announcements by audience + expiry
  const relevantAnnouncements = useMemo(() => {
    const now = Date.now();
    return announcements.filter((a) => {
      // Expired?
      if (a.expiresAt) {
        const exp = a.expiresAt.seconds
          ? a.expiresAt.seconds * 1000
          : new Date(a.expiresAt).getTime();
        if (exp < now) return false;
      }
      // Audience
      if (a.audience === "faculty") {
        return a.faculty && profile?.faculty === a.faculty;
      }
      if (a.audience === "level") {
        return a.level && profile?.level === a.level;
      }
      if (a.audience === "department") {
        return a.department && profile?.department === a.department;
      }
      return true; // all
    });
  }, [announcements, profile]);

  // Combined feed (newest first)
  const feed = useMemo(() => {
    const annItems = relevantAnnouncements.map((a) => ({
      ...a,
      _type: "announcement",
      _read: !!readMap[a.id],
      _sort: a.createdAt?.seconds || 0,
    }));
    const sysItems = systemNotifs.map((n) => ({
      ...n,
      _type: "system",
      _read: n.readByUser === true,
      _sort: n.createdAt?.seconds || 0,
    }));
    return [...annItems, ...sysItems].sort((a, b) => b._sort - a._sort);
  }, [relevantAnnouncements, systemNotifs, readMap]);

  const unreadCount = useMemo(() => {
    const unreadAnn = relevantAnnouncements.filter((a) => !readMap[a.id]).length;
    const unreadSys = systemNotifs.filter((n) => !n.readByUser).length;
    return unreadAnn + unreadSys;
  }, [relevantAnnouncements, readMap, systemNotifs]);

  async function markAnnouncementRead(announcementId) {
    if (!user || readMap[announcementId]) return;
    if (authMode === "api") {
      await announcementsApi.markRead(announcementId);
      setReadMap((current) => ({ ...current, [announcementId]: true }));
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
    if (authMode === "api") {
      await notificationsApi.markRead(notifId);
      setSystemNotifs((items) => items.map((item) => item.id === notifId ? { ...item, readByUser: true } : item));
      return;
    }
    await updateDoc(doc(db, "notifications", notifId), {
      readByUser: true,
      readAt: serverTimestamp(),
    });
  }

  async function markAllRead() {
    if (!user) return;
    if (authMode === "api") {
      await Promise.all(systemNotifs.filter((item) => !item.readByUser).map((item) => notificationsApi.markRead(item.id)));
      setSystemNotifs((items) => items.map((item) => ({ ...item, readByUser: true })));
      setReadMap((current) => ({
        ...current,
        ...Object.fromEntries(relevantAnnouncements.map((item) => [item.id, true])),
      }));
      return;
    }
    const batch = writeBatch(db);

    // Unread announcements
    relevantAnnouncements.forEach((a) => {
      if (!readMap[a.id]) {
        const id = `${user.uid}_${a.id}`;
        batch.set(doc(db, "announcementReads", id), {
          userId: user.uid,
          announcementId: a.id,
          readAt: serverTimestamp(),
        });
      }
    });

    // Unread system notifications
    systemNotifs.forEach((n) => {
      if (!n.readByUser) {
        batch.update(doc(db, "notifications", n.id), {
          readByUser: true,
          readAt: serverTimestamp(),
        });
      }
    });

    await batch.commit();
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
    readMap,
  };
}