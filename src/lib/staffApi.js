import { api, API_BASE } from "./api";

const qs = (params = {}) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : "";
};

/** Staff access: duties, permissions, the catalogue */
export const accessApi = {
  catalog: () => api("/access/catalog"),
  staff: () => api("/access/staff"),
  update: (userId, body) => api(`/users/${userId}/access`, { method: "PUT", body }),
};

/** Document Center */
export const filesApi = {
  summary: () => api("/files/summary"),
  materials: (params) => api(`/files/materials${qs(params)}`),
  restoreMaterial: (id) => api(`/files/materials/${id}/restore`, { method: "POST" }),
  setMaterialStatus: (id, status) => api(`/files/materials/${id}/status`, { method: "POST", body: { status } }),
  removeMaterial: (id) => api(`/files/materials/${id}`, { method: "DELETE" }),
  groupFiles: (params) => api(`/files/group${qs(params)}`),
  restoreGroupFile: (id) => api(`/files/group/${id}/restore`, { method: "POST" }),
  vaultUsers: (params) => api(`/files/vault${qs(params)}`),
  vaultUser: (userId) => api(`/files/vault/${userId}`),
  unlockVault: (userId) => api(`/files/vault/${userId}/unlock`, { method: "POST" }),
  restoreVaultFile: (id) => api(`/files/vault-files/${id}/restore`, { method: "POST" }),
  /** Opens a vault file for support. Needs a written reason; the student is told. */
  async openVaultFile(id, reason) {
    const res = await fetch(`${API_BASE}/files/vault-files/${id}/open`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("academicall_token") || ""}` },
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Couldn't open that file");
    }
    return res.blob();
  },
};

/** Secretariat */
export const secretariatApi = {
  overview: () => api("/secretariat/overview"),
  records: (params) => api(`/secretariat/records${qs(params)}`),
  record: (id) => api(`/secretariat/records/${id}`),
  create: (body) => api("/secretariat/records", { method: "POST", body }),
  update: (id, body) => api(`/secretariat/records/${id}`, { method: "PATCH", body }),
  remove: (id) => api(`/secretariat/records/${id}`, { method: "DELETE" }),
  journal: (params) => api(`/secretariat/activity${qs(params)}`),
};

export const RECORD_KINDS = [
  { id: "memo", label: "Memo" },
  { id: "minutes", label: "Minutes" },
  { id: "letter", label: "Letter" },
  { id: "report", label: "Report" },
  { id: "circular", label: "Circular" },
  { id: "notice", label: "Notice" },
  { id: "other", label: "Other" },
];

export function formatBytes(bytes = 0) {
  if (!bytes) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export function timeAgo(value) {
  if (!value) return "—";
  const d = new Date(value);
  const s = Math.round((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  if (s < 86400 * 7) return `${Math.round(s / 86400)} d ago`;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}
