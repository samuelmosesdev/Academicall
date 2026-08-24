import { useEffect, useState } from "react";
import { collection, limit, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase/config";

/** Live count of unread admin notifications (e.g. new signups, failed payments). */
export function useNotifications() {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // Capped: this drives a badge, so an exact count past the cap is not worth
    // streaming the whole unread backlog on every admin page.
    const q = query(
      collection(db, "notifications"),
      where("readByAdmin", "==", false),
      limit(100)
    );
    const unsub = onSnapshot(q, (snap) => setUnreadCount(snap.size));
    return unsub;
  }, []);

  return { unreadCount };
}
