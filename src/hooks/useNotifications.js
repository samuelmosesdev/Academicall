import { useEffect, useState } from "react";
import { collection, limit, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { notificationsApi } from "../lib/api";

/** Live count of unread admin notifications (e.g. new signups, failed payments). */
export function useNotifications() {
  const { authMode } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (authMode === "api") {
      let alive = true;
      notificationsApi.listAdmin().then(({ notifications = [] }) => {
        if (alive) setUnreadCount(notifications.filter((item) => !item.readByUser).length);
      }).catch(() => {});
      return () => { alive = false; };
    }

    // Capped: this drives a badge, so an exact count past the cap is not worth
    // streaming the whole unread backlog on every admin page.
    setUnreadCount(0);
    return undefined;
  }, [authMode]);

  return { unreadCount };
}
