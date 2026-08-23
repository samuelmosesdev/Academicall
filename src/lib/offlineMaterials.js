/**
 * Offline materials store (IndexedDB).
 * Used in the Capacitor app so students can open saved files without data.
 * Website can call the same APIs; UI only exposes the button in the native app.
 */

const DB_NAME = "academicall_offline";
const DB_VERSION = 1;
const STORE = "materials";

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error || new Error("IndexedDB open failed"));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
  });
}

function idbReq(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** List all offline material metadata (no blob). */
export async function listOfflineMaterials() {
  const db = await openDb();
  const tx = db.transaction(STORE, "readonly");
  const all = await idbReq(tx.objectStore(STORE).getAll());
  return (all || []).map(({ blob, ...meta }) => meta);
}

export async function getOfflineMaterial(id) {
  if (!id) return null;
  const db = await openDb();
  const tx = db.transaction(STORE, "readonly");
  return idbReq(tx.objectStore(STORE).get(id));
}

export async function isOfflineAvailable(id) {
  const row = await getOfflineMaterial(id);
  return !!(row && row.blob);
}

/**
 * Download a remote file and store it on-device.
 * @param {{ id: string, title?: string, fileUrl: string, courseCode?: string, fileName?: string }} meta
 */
export async function saveMaterialOffline(meta) {
  if (!meta?.id || !meta?.fileUrl) throw new Error("Missing material id or URL");
  const res = await fetch(meta.fileUrl);
  if (!res.ok) throw new Error("Could not download file for offline use");
  const blob = await res.blob();
  const row = {
    id: String(meta.id),
    title: meta.title || "Material",
    courseCode: meta.courseCode || "",
    fileName: meta.fileName || meta.title || "file",
    mimeType: blob.type || "application/pdf",
    size: blob.size,
    savedAt: Date.now(),
    sourceUrl: meta.fileUrl,
    blob,
  };
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  await idbReq(tx.objectStore(STORE).put(row));
  return { id: row.id, size: row.size, title: row.title };
}

export async function removeMaterialOffline(id) {
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  await idbReq(tx.objectStore(STORE).delete(String(id)));
}

/** Object URL for offline viewer — remember to revoke later. */
export async function getOfflineObjectUrl(id) {
  const row = await getOfflineMaterial(id);
  if (!row?.blob) return null;
  return URL.createObjectURL(row.blob);
}
