/**
 * API calls for the safety, security, coaching, results, tests and data
 * features (see docs/STAFF-AND-STUDENT-GAPS.md).
 */
import { api, API_BASE } from "./api";

const q = (params = {}) => {
  const s = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "")).toString();
  return s ? `?${s}` : "";
};

/** Download an authenticated file (JSON export, CSV) and save it. */
export async function downloadAuthed(path, fallbackName) {
  const token = localStorage.getItem("academicall_token");
  const res = await fetch(`${API_BASE}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Download failed (${res.status})`);
  }
  const blob = await res.blob();
  const name = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") || "")?.[1] || fallbackName;
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 4000);
}

export const twoFactorApi = {
  verify: (challengeId, code) => api("/auth/2fa/verify", { method: "POST", body: { challengeId, code } }),
  resend: (challengeId) => api("/auth/2fa/resend", { method: "POST", body: { challengeId } }),
  status: () => api("/me/2fa"),
  totpStart: () => api("/me/2fa/totp/start", { method: "POST" }),
  totpConfirm: (setupId, code) => api("/me/2fa/totp/confirm", { method: "POST", body: { setupId, code } }),
  emailStart: () => api("/me/2fa/email/start", { method: "POST" }),
  emailConfirm: (setupId, code) => api("/me/2fa/email/confirm", { method: "POST", body: { setupId, code } }),
  backupCodes: (body) => api("/me/2fa/backup-codes", { method: "POST", body }),
  disable: (body) => api("/me/2fa", { method: "DELETE", body }),
};

export const sessionsApi = {
  list: () => api("/me/sessions"),
  end: (id) => api(`/me/sessions/${id}`, { method: "DELETE" }),
  endOthers: () => api("/me/sessions/sign-out-others", { method: "POST" }),
  logins: () => api("/me/logins"),
};

export const meApi = {
  prefs: () => api("/me/notification-prefs"),
  savePrefs: (body) => api("/me/notification-prefs", { method: "PUT", body }),
  registerDevice: (body) => api("/me/devices", { method: "POST", body }),
  removeDevice: (token) => api("/me/devices", { method: "DELETE", body: { token } }),
  privacy: () => api("/me/privacy"),
  savePrivacy: (body) => api("/me/privacy", { method: "PUT", body }),
  blocks: () => api("/me/blocks"),
  block: (userId) => api(`/me/blocks/${userId}`, { method: "POST" }),
  unblock: (userId) => api(`/me/blocks/${userId}`, { method: "DELETE" }),
  downloadData: () => downloadAuthed("/me/data-export", "academicall-my-data.json"),
  dataRequests: () => api("/me/data-requests"),
  requestDeletion: (note) => api("/me/data-requests", { method: "POST", body: { kind: "delete", note } }),
};

export const resultsApi = {
  list: () => api("/me/results"),
  saveSemester: (body) => api("/me/results/semester", { method: "PUT", body }),
  deleteSemester: (session, semester) => api(`/me/results/semester${q({ session, semester })}`, { method: "DELETE" }),
  saveSettings: (body) => api("/me/results/settings", { method: "PUT", body }),
};

export const reportsApi = {
  create: (body) => api("/reports", { method: "POST", body }),
};

export const moderationApi = {
  summary: () => api("/admin/moderation/summary"),
  reports: (params) => api(`/admin/moderation/reports${q(params)}`),
  act: (id, body) => api(`/admin/moderation/reports/${id}/action`, { method: "POST", body }),
  restrictions: (active) => api(`/admin/moderation/restrictions${q({ active: active ? 1 : undefined })}`),
  lift: (id) => api(`/admin/moderation/restrictions/${id}/lift`, { method: "POST" }),
};

export const utmeCoachApi = {
  insights: () => api("/utme/insights"),
  saveGoals: (body) => api("/utme/goals", { method: "PUT", body }),
  report: (body) => api("/utme/reports", { method: "POST", body }),
  adminReports: (params) => api(`/admin/utme/reports${q(params)}`),
  resolve: (body) => api("/admin/utme/reports/resolve", { method: "POST", body }),
  stats: (params) => api(`/admin/utme/stats${q(params)}`),
};

export const searchApi = {
  search: (term, limit = 6) => api(`/search${q({ q: term, limit })}`),
};

export const testsApi = {
  // staff
  list: (status) => api(`/admin/tests${q({ status })}`),
  get: (id) => api(`/admin/tests/${id}`),
  create: (body) => api("/admin/tests", { method: "POST", body }),
  update: (id, body) => api(`/admin/tests/${id}`, { method: "PUT", body }),
  options: () => api("/admin/tests/options"),
  people: (term, ids) => api(`/admin/tests/people${q({ q: term, ids: ids?.join(",") })}`),
  preview: (audience) => api("/admin/tests/audience-preview", { method: "POST", body: { audience } }),
  publish: (id, notify = true) => api(`/admin/tests/${id}/publish`, { method: "POST", body: { notify } }),
  close: (id) => api(`/admin/tests/${id}/close`, { method: "POST" }),
  reopen: (id, closesAt) => api(`/admin/tests/${id}/reopen`, { method: "POST", body: { closesAt } }),
  duplicate: (id) => api(`/admin/tests/${id}/duplicate`, { method: "POST" }),
  remove: (id) => api(`/admin/tests/${id}`, { method: "DELETE" }),
  results: (id) => api(`/admin/tests/${id}/results`),
  resultsCsv: (id) => downloadAuthed(`/admin/tests/${id}/results?format=csv`, "test-results.csv"),
  // candidates
  mine: () => api("/tests"),
  start: (id) => api(`/tests/${id}/start`, { method: "POST" }),
  save: (id, answers) => api(`/tests/${id}/answers`, { method: "PUT", body: { answers } }),
  submit: (id, answers) => api(`/tests/${id}/submit`, { method: "POST", body: { answers } }),
  result: (id) => api(`/tests/${id}/result`),
};

export const securityAdminApi = {
  overview: () => api("/admin/security"),
  save: (requireStaff2fa) => api("/admin/security", { method: "PUT", body: { requireStaff2fa } }),
  user: (id) => api(`/users/${id}/security`),
  reset2fa: (id, reason) => api(`/users/${id}/2fa/reset`, { method: "POST", body: { reason } }),
  endSession: (id, sid) => api(`/users/${id}/sessions/${sid}`, { method: "DELETE" }),
};

export const dataAdminApi = {
  requests: (params) => api(`/admin/data-requests${q(params)}`),
  update: (id, body) => api(`/admin/data-requests/${id}`, { method: "PATCH", body }),
  exportUser: (id, reason) => downloadAuthed(`/admin/users/${id}/export${q({ reason })}`, "user-data.json"),
  backups: () => api("/admin/backups"),
  runBackup: () => api("/admin/backups/run", { method: "POST" }),
};

export const featuresExtraApi = {
  setMode: (key, mode, audience, note) => api(`/admin/features/${key}`, { method: "PUT", body: { mode, audience, note } }),
  maintenance: (body) => api("/admin/maintenance", { method: "PUT", body }),
  banner: (body) => api("/admin/banner", { method: "PUT", body }),
  betaTesters: (term) => api(`/admin/beta-testers${q({ q: term })}`),
  setBeta: (id, betaTester) => api(`/admin/beta-testers/${id}`, { method: "PUT", body: { betaTester } }),
};

/** Lagos-time formatting used across these screens. */
export const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString("en-GB", { timeZone: "Africa/Lagos", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-GB", { timeZone: "Africa/Lagos", day: "numeric", month: "short", year: "numeric" }) : "—");
export function timeAgo(d) {
  if (!d) return "—";
  const s = Math.round((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)} d ago`;
  return fmtDate(d);
}
