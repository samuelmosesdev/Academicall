import { useCallback, useEffect, useMemo, useState } from "react";
import { collection, deleteDoc, doc, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { materialSavesApi } from "../lib/api";

export const FOLDER_TONES = ["lemon", "aqua", "violet", "sand"];

export function toDate(value) {
  if (!value) return null;
  if (value.toDate) return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function fileExtension(item = {}) {
  const source = item.fileName || item.fileUrl || item.title || "";
  const match = String(source).split("?")[0].match(/\.([a-zA-Z0-9]{2,5})$/);
  return match ? match[1].toLowerCase() : "pdf";
}

export function folderSlug(code) {
  return encodeURIComponent(String(code || "GENERAL").toUpperCase());
}

export function materialKey(item) {
  return String(item.id);
}

export default function useMaterialSaves() {
  const { user, authMode } = useAuth();
  const [saves, setSaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");

    if (authMode === "api") {
      materialSavesApi
        .list()
        .then(({ saves: list = [] }) => {
          if (!alive) return;
          setSaves(
            list.map((item) => ({
              ...(item.meta || {}),
              id: item.id,
              materialId: item.materialId,
              title: item.title || item.meta?.title,
              fileUrl: item.url || item.meta?.fileUrl || item.meta?.url,
              courseCode: item.meta?.course?.code || item.meta?.courseCode || "GENERAL",
              courseTitle: item.meta?.course?.title || item.meta?.courseTitle || "",
              savedAt: item.createdAt || item.savedAt || item.meta?.savedAt,
            }))
          );
        })
        .catch((err) => {
          if (!alive) return;
          setSaves([]);
          setError(err.message || "Could not load your saved materials.");
        })
        .finally(() => alive && setLoading(false));
      return () => {
        alive = false;
      };
    }

    if (!user) {
      setSaves([]);
      setLoading(false);
      return () => {
        alive = false;
      };
    }

    const savesQuery = query(collection(db, "materialSaves"), where("userId", "==", user.uid));
    const unsubscribe = onSnapshot(
      savesQuery,
      (snapshot) => {
        if (!alive) return;
        setSaves(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
        setLoading(false);
      },
      (err) => {
        if (!alive) return;
        setError(err.message || "Could not load your saved materials.");
        setLoading(false);
      }
    );
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [user, authMode]);

  const sorted = useMemo(
    () =>
      [...saves].sort(
        (a, b) => (toDate(b.savedAt)?.getTime() || 0) - (toDate(a.savedAt)?.getTime() || 0)
      ),
    [saves]
  );

  const folders = useMemo(() => {
    const map = new Map();
    for (const item of sorted) {
      const code = String(item.courseCode || "GENERAL").toUpperCase();
      if (!map.has(code)) {
        map.set(code, {
          courseCode: code,
          courseTitle: item.courseTitle || "",
          items: [],
          lastSaved: null,
        });
      }
      const folder = map.get(code);
      if (!folder.courseTitle && item.courseTitle) folder.courseTitle = item.courseTitle;
      folder.items.push(item);
      const savedAt = toDate(item.savedAt);
      if (savedAt && (!folder.lastSaved || savedAt > folder.lastSaved)) folder.lastSaved = savedAt;
    }
    return Array.from(map.values())
      .sort((a, b) => a.courseCode.localeCompare(b.courseCode))
      .map((folder, index) => ({ ...folder, tone: FOLDER_TONES[index % FOLDER_TONES.length] }));
  }, [sorted]);

  const remove = useCallback(
    async (saveId) => {
      if (authMode === "api") await materialSavesApi.remove(saveId);
      else await deleteDoc(doc(db, "materialSaves", saveId));
      setSaves((current) => current.filter((item) => item.id !== saveId));
    },
    [authMode]
  );

  return { saves: sorted, folders, loading, error, remove };
}
