import { useEffect, useState } from "react";
import { collection, limit, onSnapshot, query } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { documentsApi } from "../lib/api";

export function useStudentDocuments() {
  const { authMode } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authMode === "api") {
      let alive = true;
      setLoading(true);
      documentsApi
        .list()
        .then(({ documents: apiDocuments = [] }) => {
          if (!alive) return;
          setDocuments(
            apiDocuments.map((document) => ({
              ...document,
              courseCode: document.course?.code || "",
              courseTitle: document.course?.title || "",
              uploadedAt: document.createdAt,
            }))
          );
        })
        .catch(() => {
          if (alive) setDocuments([]);
        })
        .finally(() => {
          if (alive) setLoading(false);
        });
      return () => {
        alive = false;
      };
    }

    const unsub = onSnapshot(
      query(collection(db, "documents"), limit(500)),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => (b.uploadedAt?.seconds || 0) - (a.uploadedAt?.seconds || 0));
        setDocuments(list);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, [authMode]);

  return { documents, loading };
}