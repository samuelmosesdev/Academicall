import { useEffect, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { requestsApi } from "../lib/api";

/** Live list of approval requests (newest first). */
export function useRequests() {
  const { authMode } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authMode === "api") {
      let alive = true;
      requestsApi.list().then(({ requests: list = [] }) => {
        if (!alive) return;
        setRequests(list);
        setLoading(false);
      }).catch(() => alive && setLoading(false));
      return () => { alive = false; };
    }

    const q = query(collection(db, "requests"), orderBy("createdAt", "desc"), limit(200));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, [authMode]);

  return { requests, loading };
}
