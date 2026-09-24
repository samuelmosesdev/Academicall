import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { documentsApi } from "../lib/api";

export function useAdminDocuments() {
  const { authMode } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  async function loadApi() {
    const { documents: list = [] } = await documentsApi.list();
    setDocuments(list.map((document) => ({
      ...document,
      courseCode: document.course?.code || "",
      courseTitle: document.course?.title || "",
      uploadedAt: document.createdAt,
    })));
  }

  useEffect(() => {
    if (authMode === "api") {
      let alive = true;
      loadApi().then(() => {
        if (!alive) return;
        setLoading(false);
      }).catch(() => alive && setLoading(false));
      return () => { alive = false; };
    }

    setLoading(false);
    setDocuments([]);
    return undefined;
  }, [authMode]);

  return { documents, loading, retry: authMode === "api" ? loadApi : () => {} };
}