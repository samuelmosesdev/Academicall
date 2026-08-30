import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { documentsApi } from "../lib/api";

export function useAdminDocuments() {
  const { authMode } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authMode === "api") {
      let alive = true;
      documentsApi.list().then(({ documents: list = [] }) => {
        if (!alive) return;
        setDocuments(list.map((document) => ({
          ...document,
          courseCode: document.course?.code || "",
          courseTitle: document.course?.title || "",
          uploadedAt: document.createdAt,
        })));
        setLoading(false);
      }).catch(() => alive && setLoading(false));
      return () => { alive = false; };
    }

    setLoading(false);
    setDocuments([]);
    return undefined;
  }, [authMode]);

  return { documents, loading };
}