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

const LOCAL_READ_KEY = "academicall_staff_chat_last_read_at";

/**
 * Unread Staff HQ messages for the current staff user.
 * lastReadAt stored on users/{uid}.staffChatLastReadAt
 */
export function useStaffChatUnread() {
  const { user, profile, authMode } = useAuth();
  const [unread, setUnread] = useState(0);
  const [latestAt, setLatestAt] = useState(null);
  const [localLastReadAt, setLocalLastReadAt] = useState(() =>
    localStorage.getItem(LOCAL_READ_KEY)
  );

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
      chatApi.list().then(({ messages = [], lastReadAt }) => {
        if (!alive) return;
        const own = user?.uid;
        const serverReadMs = lastReadAt ? new Date(lastReadAt).getTime() : 0;
        const localReadMs = localLastReadAt ? new Date(localLastReadAt).getTime() : 0;
        const readMs = Math.max(serverReadMs, localReadMs);
        const visible = messages.filter((message) => {
          if (message.deleted || message.authorId === own || message.authorUid === own) return false;
          const createdAt = message.createdAt ? new Date(message.createdAt).getTime() : 0;
          return createdAt > readMs;
        });
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
  }, [user?.uid, localLastReadAt, authMode]);

  useEffect(() => {
    const syncReadState = (event) => {
      if (event.key === LOCAL_READ_KEY || event.type === "staff-chat-read") {
        setLocalLastReadAt(localStorage.getItem(LOCAL_READ_KEY));
        setUnread(0);
      }
    };
    window.addEventListener("storage", syncReadState);
    window.addEventListener("staff-chat-read", syncReadState);
    return () => {
      window.removeEventListener("storage", syncReadState);
      window.removeEventListener("staff-chat-read", syncReadState);
    };
  }, []);

  // MUST be stable. Callers put this in effect dependency arrays, and it writes
  // to users/{uid} — an unstable identity here closed a write -> snapshot ->
  // re-render -> write loop that burned the daily quota in minutes.
  const markStaffChatRead = useCallback(async () => {
    if (authMode === "api") {
      const readAt = new Date().toISOString();
      localStorage.setItem(LOCAL_READ_KEY, readAt);
      setLocalLastReadAt(readAt);
      setUnread(0);
      window.dispatchEvent(new Event("staff-chat-read"));
      try {
        await chatApi.markRead();
      } catch (e) {
        console.warn("markStaffChatRead", e);
      }
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
