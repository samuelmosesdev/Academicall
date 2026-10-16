import { api } from "./api";

const qs = (o = {}) => {
  const p = new URLSearchParams();
  Object.entries(o).forEach(([k, v]) => v !== undefined && v !== null && v !== "" && p.set(k, v));
  const s = p.toString();
  return s ? `?${s}` : "";
};

/** The signed-in aspirant: choices, houses, pinned posts. */
export const aspirantApi = {
  me: () => api("/aspirant/me"),
  save: (body) => api("/aspirant/me", { method: "PUT", body }),
  admitted: (institutionId) => api("/aspirant/me/admitted", { method: "POST", body: { institutionId } }),
};

/** Aspirant Houses: members read + reply; House Leaders post, pin, mention and manage. */
export const housesApi = {
  mine: () => api("/houses"),
  get: (id) => api(`/houses/${id}`),
  read: (id) => api(`/houses/${id}/read`, { method: "POST" }),
  threads: (id, { before } = {}) => api(`/houses/${id}/threads${qs({ before })}`),
  createThread: (id, body) => api(`/houses/${id}/threads`, { method: "POST", body }),
  thread: (id, threadId) => api(`/houses/${id}/threads/${threadId}`),
  updateThread: (id, threadId, body) => api(`/houses/${id}/threads/${threadId}`, { method: "PATCH", body }),
  deleteThread: (id, threadId) => api(`/houses/${id}/threads/${threadId}`, { method: "DELETE" }),
  reply: (id, threadId, body) => api(`/houses/${id}/threads/${threadId}/replies`, { method: "POST", body }),
  deleteReply: (id, replyId) => api(`/houses/${id}/replies/${replyId}`, { method: "DELETE" }),
  members: (id, params) => api(`/houses/${id}/members${qs(params)}`),
  setMember: (id, userId, status, reason) => api(`/houses/${id}/members/${userId}`, { method: "PATCH", body: { status, reason } }),
};

export const adminAspirantsApi = {
  list: (params) => api(`/admin/aspirants${qs({ page: 1, ...params })}`),
  get: (id) => api(`/admin/aspirants/${id}`),
  update: (id, body) => api(`/admin/aspirants/${id}`, { method: "PATCH", body }),
};

export const adminHousesApi = {
  list: (params) => api(`/admin/houses${qs({ page: 1, ...params })}`),
  create: (institutionId) => api("/admin/houses", { method: "POST", body: { institutionId } }),
  update: (id, body) => api(`/admin/houses/${id}`, { method: "PATCH", body }),
  candidates: (q) => api(`/admin/houses/leader-candidates${qs({ q })}`),
  addLeader: (id, userId) => api(`/admin/houses/${id}/leaders`, { method: "POST", body: { userId } }),
  removeLeader: (id, userId) => api(`/admin/houses/${id}/leaders/${userId}`, { method: "DELETE" }),
};

/** Student dashboard board (curated by admins / agents with board.manage). */
export const boardApi = {
  get: (audience) => api(`/board${qs({ audience })}`),
  admin: () => api("/admin/board"),
  create: (body) => api("/admin/board/slides", { method: "POST", body }),
  update: (id, body) => api(`/admin/board/slides/${id}`, { method: "PATCH", body }),
  remove: (id) => api(`/admin/board/slides/${id}`, { method: "DELETE" }),
  reorder: (ids) => api("/admin/board/reorder", { method: "POST", body: { ids } }),
  settings: (body) => api("/admin/board/settings", { method: "PUT", body }),
};

/* ── mentions ─────────────────────────────────────────────────────────────
 * Stored as @[Display Name](user:<uuid>). Only House Leaders' mentions notify.
 */
export const MENTION_RX = /@\[([^\]\n]{1,80})\]\(user:([0-9a-f-]{36})\)/gi;
export const mentionToken = (name, id) => `@[${String(name).replace(/[[\]\n]/g, "").slice(0, 80)}](user:${id})`;
export const plainText = (text = "") => text.replace(MENTION_RX, (_m, name) => `@${name}`);

export function institutionTitle(inst) {
  if (!inst) return "";
  if (inst.title) return inst.title;
  if (inst.displayName) return inst.displayName;
  const s = String(inst.name || "");
  if (s !== s.toUpperCase()) return s;
  const small = new Set(["and", "of", "the", "in", "for", "to", "&", "on", "at"]);
  return s.toLowerCase().split(/(\s+|\/|-|\()/).map((w, i) => (!w.trim() || /^[\s/(-]$/.test(w) ? w : i > 0 && small.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1))).join("");
}
