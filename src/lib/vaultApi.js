import { api, API_BASE } from "./api";

/**
 * Academicall Vault client.
 * The vault token lives only in memory: a refresh, a new tab, 5 idle minutes
 * or the app going to the background locks the vault again.
 */
let session = null; // { token, expiresAt }
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn(isUnlocked()));

export function onVaultLockChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export function isUnlocked() {
  return !!session && session.expiresAt > Date.now();
}
function setSession(res) {
  if (res?.vaultToken) session = { token: res.vaultToken, expiresAt: Date.now() + (res.expiresIn || 900) * 1000 - 5000 };
  emit();
  return res;
}
export function lockVault() {
  session = null;
  emit();
}

function vaultHeaders() {
  if (!isUnlocked()) {
    lockVault();
    const e = new Error("Your vault locked itself. Enter your PIN again.");
    e.code = "vault_locked";
    throw e;
  }
  return { "X-Vault-Token": session.token };
}

async function vcall(path, options = {}) {
  try {
    return await api(path, { ...options, headers: { ...vaultHeaders(), ...(options.headers || {}) } });
  } catch (err) {
    if (err.status === 401) lockVault();
    throw err;
  }
}

export const VAULT_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
export const VAULT_ACCEPT = ".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf";
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

export const vaultApi = {
  status: () => api("/vault/status"),
  createPin: (pin) => api("/vault/pin", { method: "POST", body: { pin } }).then(setSession),
  unlock: (pin) => api("/vault/unlock", { method: "POST", body: { pin } }).then(setSession),
  changePin: (currentPin, newPin) => api("/vault/pin/change", { method: "POST", body: { currentPin, newPin } }).then(setSession),
  sendRecovery: () => api("/vault/recovery/send", { method: "POST" }),
  resetWithCode: (code, newPin) => api("/vault/recovery/reset", { method: "POST", body: { code, newPin } }).then(setSession),

  folders: () => vcall("/vault/folders"),
  createFolder: (body) => vcall("/vault/folders", { method: "POST", body }),
  updateFolder: (id, body) => vcall(`/vault/folders/${id}`, { method: "PATCH", body }),
  deleteFolder: (id) => vcall(`/vault/folders/${id}`, { method: "DELETE" }),
  files: (folderId) => vcall(`/vault/folders/${folderId}/files`),
  updateFile: (id, body) => vcall(`/vault/files/${id}`, { method: "PATCH", body }),
  deleteFile: (id) => vcall(`/vault/files/${id}`, { method: "DELETE" }),

  /** Upload one file with progress. Resolves { file, usage }. */
  upload(folderId, file, onProgress) {
    return new Promise((resolve, reject) => {
      let headers;
      try { headers = vaultHeaders(); } catch (e) { reject(e); return; }
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API_BASE}/vault/folders/${folderId}/files`);
      xhr.setRequestHeader("Authorization", `Bearer ${localStorage.getItem("academicall_token")}`);
      xhr.setRequestHeader("X-Vault-Token", headers["X-Vault-Token"]);
      xhr.setRequestHeader("X-File-Name", encodeURIComponent(file.name));
      xhr.setRequestHeader("Content-Type", "application/octet-stream");
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
      xhr.onload = () => {
        let data = {};
        try { data = JSON.parse(xhr.responseText || "{}"); } catch { /* ignore */ }
        if (xhr.status >= 200 && xhr.status < 300) resolve(data);
        else {
          if (xhr.status === 401) lockVault();
          const e = new Error(data.error || "Upload failed");
          e.status = xhr.status;
          reject(e);
        }
      };
      xhr.onerror = () => reject(new Error("Network error. Check your connection and try again."));
      xhr.send(file);
    });
  },

  /** Fetch decrypted bytes as an object URL (caller must revoke). */
  async blobUrl(fileId) {
    const res = await fetch(`${API_BASE}/vault/files/${fileId}/content`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("academicall_token")}`, ...vaultHeaders() },
    });
    if (!res.ok) {
      if (res.status === 401) lockVault();
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Couldn't open that file");
    }
    return URL.createObjectURL(await res.blob());
  },
};

export function formatBytes(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}
