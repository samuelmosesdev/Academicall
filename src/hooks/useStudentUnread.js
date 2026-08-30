import { useEffect, useState } from "react";
import { collection, limit, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";

/**
 * Unread platform notifications for the student (department updates, etc.)
 */
export function useStudentUnread() {
  const { user, authMode } = useAuth();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (authMode === "api") {
      setUnread(0);
      return;
    }
    if (!user) {
      setUnread(0);
      return;
    }
    // Prefer user-targeted notifications with readByUser !== true
    const q = query(
      collection(db, "notifications"),
      where("userId", "==", user.uid),
      limit(100)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        let n = 0;
        snap.docs.forEach((d) => {
          const data = d.data();
          if (data.deleted || data.archived) return;
          if (data.readByUser === true) return;
          n += 1;
        });
        setUnread(n);
      },
      () => {
        // Fallback: no index / field — try readByUser false only if needed
        setUnread(0);
      }
    );
    return unsub;
  }, [user, authMode]);

  return { unread };
}
