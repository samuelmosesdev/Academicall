import { useEffect, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { announcementsApi } from "../lib/api";

export function useAdminAnnouncements() {
  const { authMode } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authMode === "api") {
      let alive = true;
      announcementsApi.list().then(({ announcements: list = [] }) => {
        if (!alive) return;
        setAnnouncements(list);
        setLoading(false);
      }).catch(() => alive && setLoading(false));
      return () => { alive = false; };
    }

    const q = query(collection(db, "announcements"), orderBy("createdAt", "desc"), limit(100));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setAnnouncements(list);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, [authMode]);

  return { announcements, loading };
}