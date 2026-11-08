import { api } from "./api";

/** My materials: the student's own uploads, saved materials and folders. */
export const myMaterialsApi = {
  overview: () => api("/my-materials", { cache: "no-store" }),
  createFolder: (body) => api("/my-materials/folders", { method: "POST", body }),
  updateFolder: (id, body) => api(`/my-materials/folders/${id}`, { method: "PATCH", body }),
  deleteFolder: (id) => api(`/my-materials/folders/${id}`, { method: "DELETE" }),
  move: (body) => api("/my-materials/move", { method: "POST", body }),
  remove: (body) => api("/my-materials/remove", { method: "POST", body }),
  renameUpload: (id, title) => api(`/my-materials/uploads/${id}`, { method: "PATCH", body: { title } }),
  renameSave: (id, title) => api(`/my-materials/saves/${id}`, { method: "PATCH", body: { title } }),
  /** Personal upload: the file goes to Cloudinary first, then this records it. */
  createUpload: (body) => api("/documents", { method: "POST", body }),
};

/** Material sharing: send a file or folder to someone by their Unique ID. */
export const materialSharesApi = {
  list: () => api("/material-shares"),
  lookup: (uniqueId) => api(`/material-shares/recipient?uniqueId=${encodeURIComponent(uniqueId)}`),
  send: (body) => api("/material-shares", { method: "POST", body }),
  accept: (id) => api(`/material-shares/${id}/accept`, { method: "POST" }),
  decline: (id) => api(`/material-shares/${id}/decline`, { method: "POST" }),
  cancel: (id) => api(`/material-shares/${id}`, { method: "DELETE" }),
};

/** Staff: a user's material folders and files, read-only. */
export const userMaterialsApi = {
  get: (userId) => api(`/users/${userId}/materials`),
};
