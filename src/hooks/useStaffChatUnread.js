import { useCallback, useEffect, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  query,
  orderBy,
  limit,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { chatApi } from "../lib/api";

/**
 * Unread Staff HQ messages for the current staff user.
 * lastReadAt stored on users/{uid}.staffChatLastReadAt
 */
export function useStaffChatUnread() {
  const { user, profile, authMode } = useAuth();
  const [unread, setUnread] = useState(0);
  const [latestAt, setLatestAt] = useState(null);

  // Firestore Timestamps are class instances rebuilt on every snap.data(), so
  // `profile?.staffChatLastReadAt` is a new reference even when the value is
  // unchanged. Compare on the primitive instead, or this effect re-attaches the
  // 80-doc listener below on every single user-doc change.
  const lastReadMs = profile?.staffChatLastReadAt?.toMillis
    ? profile.staffChatLastReadAt.toMillis()
    : profile?.staffChatLastReadAt?.seconds
      ? profile.staffChatLastReadAt.seconds * 1000
      : 0;

  useEffect(() => {
    if (authMode === "api") {
      let alive = true;
      chatApi.list().then(({ messages = [] }) => {
        if (!alive) return;
        const own = user?.uid;
        const visible = messages.filter((message) => !message.deleted && message.authorId !== own && message.authorUid !== own);
        const latest = messages.reduce((max, message) => Math.max(max, message.createdAt ? new Date(message.createdAt).getTime() : 0), 0);
        setUnread(visible.length);
        setLatestAt(latest || null);
      }).catch(() => alive && setUnread(0));
      return () => { alive = false; };
    }
    if (!user?.uid) {
      setUnread(0);
      return;
    }
    const q = query(
      collection(db, "staffChat"),
      orderBy("createdAt", "desc"),
      limit(80)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        let count = 0;
        let maxT = 0;
        snap.docs.forEach((d) => {
          const data = d.data();
          if (data.deleted && data.authorUid !== user.uid) return;
          const t =
            data.createdAt?.toMillis?.() ||
            (data.createdAt?.seconds || 0) * 1000 ||
            (data.clientAt ? new Date(data.clientAt).getTime() : 0);
          if (t > maxT) maxT = t;
          // Don't count own messages as unread
          if (data.authorUid === user.uid) return;
          if (t > lastReadMs) count += 1;
        });
        setUnread(count);
        setLatestAt(maxT || null);
      },
      () => setUnread(0)
    );
    return unsub;
  }, [user?.uid, lastReadMs, authMode]);

  // MUST be stable. Callers put this in effect dependency arrays, and it writes
  // to users/{uid} — an unstable identity here closed a write -> snapshot ->
  // re-render -> write loop that burned the daily quota in minutes.
  const markStaffChatRead = useCallback(async () => {
    if (authMode === "api") {
      setUnread(0);
      return;
    }
    if (!user?.uid) return;
    try {
      await setDoc(
        doc(db, "users", user.uid),
        { staffChatLastReadAt: serverTimestamp() },
        { merge: true }
      );
    } catch (e) {
      console.warn("markStaffChatRead", e);
    }
  }, [user?.uid, authMode]);

  return { unread, markStaffChatRead, latestAt };
}
