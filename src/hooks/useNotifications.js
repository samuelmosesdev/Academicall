import { useCallback, useEffect, useState } from "react";
import { collection, limit, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { notificationsApi } from "../lib/api";

/** Live count of unread admin notifications (e.g. new signups, failed payments). */
export function useNotifications() {
  const { authMode } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = useCallback(() => {
    if (authMode !== "api") {
      setUnreadCount(0);
      return;
    }
    notificationsApi.listAdmin()
      .then(({ notifications = [] }) => setUnreadCount(notifications.filter((item) => item.readByAdmin !== true).length))
      .catch(() => setUnreadCount(0));
  }, [authMode]);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 60_000);
    return () => clearInterval(timer);
  }, [refresh]);

  return { unreadCount, refresh };
}
