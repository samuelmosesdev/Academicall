import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { notificationsApi } from "../lib/api";
import { subscribe as subscribeRealtime } from "../lib/realtime";

/** Fired after staff mark inbox items read so every badge re-counts at once. */
export const ADMIN_NOTIFICATIONS_UPDATED_EVENT = "admin-notifications-updated";

export function announceAdminNotificationsChanged() {
  window.dispatchEvent(new Event(ADMIN_NOTIFICATIONS_UPDATED_EVENT));
}

/** Live count of unread staff-inbox notifications (e.g. new signups, failed payments). */
export function useNotifications() {
  const { authMode } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = useCallback(() => {
    if (authMode !== "api") {
      setUnreadCount(0);
      return;
    }
    notificationsApi.listAdmin()
      .then(({ notifications = [], unreadCount: total }) =>
        setUnreadCount(typeof total === "number" ? total : notifications.filter((item) => item.readByAdmin !== true).length))
      .catch(() => setUnreadCount(0));
  }, [authMode]);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 60_000);
    window.addEventListener(ADMIN_NOTIFICATIONS_UPDATED_EVENT, refresh);
    window.addEventListener("focus", refresh);
    const off = subscribeRealtime("notification", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener(ADMIN_NOTIFICATIONS_UPDATED_EVENT, refresh);
      window.removeEventListener("focus", refresh);
      off?.();
    };
  }, [refresh]);

  return { unreadCount, refresh };
}
