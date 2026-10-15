export const API_BASE = (
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV
    ? "http://localhost:4000/api/v1"
    : "https://academicall-api-1.onrender.com/api/v1")
).replace(/\/$/, "");
const API_TIMEOUT_MS = 15000;
export const STUDENT_NOTIFICATIONS_UPDATED_EVENT = "student-notifications-updated";

function getToken() {
  return localStorage.getItem("academicall_token");
}

/**
 * Staff can sign someone out everywhere or force a password change. When the
 * API says so, send the person to sign in again / to the change-password page.
 */
function handleAccessSignals(status, data) {
  if (typeof window === "undefined") return;
  const path = window.location.pathname;
  if (status === 401 && data?.code === "session_revoked") {
    localStorage.removeItem("academicall_token");
    if (!path.startsWith("/login")) window.location.assign("/login?signedOut=1");
  } else if (status === 403 && data?.code === "password_change_required" && path !== "/change-password") {
    window.location.assign("/change-password");
  }
}

export async function api(endpoint, options = {}) {
  const token = getToken();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  const config = {
    ...options,
    signal: options.signal || controller.signal,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  };

  if (options.body && typeof options.body === "object") {
    config.body = JSON.stringify(options.body);
  }

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, config);
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error("API Error Response:", data);
      handleAccessSignals(res.status, data);
      const details = Array.isArray(data.error)
        ? data.error.map((item) => item.message || item.path?.join(".")).filter(Boolean).join(", ")
        : data.reason || data.error;
      const message = [details || data.message, data.detail].filter(Boolean).join(" — ")
        || `Request failed with status ${res.status}`;
      const error = new Error(message);
      error.status = res.status;
      throw error;
    }

    return data;
  } catch (err) {
    console.error("Network / Fetch Error:", err);
    if (err.name === "AbortError") {
      throw new Error("The server took too long to respond. Please try again.");
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Auth helpers
export const authApi = {
  register: (body) => api("/auth/register", { method: "POST", body }),
  login: (body) => api("/auth/login", { method: "POST", body }),
  changePassword: (body) => api("/auth/password/change", { method: "POST", body }),
  requestPasswordReset: (body) => api("/auth/password-reset/request", { method: "POST", body }),
  confirmPasswordReset: (body) => api("/auth/password-reset/confirm", { method: "POST", body }),
  google: (credential) => api("/auth/google", { method: "POST", body: { credential } }),
  me: () => api("/auth/me"),
  sendVerification: () => api("/auth/verification/send", { method: "POST" }),
  verifyEmail: (code) => api("/auth/verification/verify", { method: "POST", body: { code } }),
};

// Other resources (ready for later)
export const usersApi = {
  me: () => api("/users/me"),
  updateMe: (body) => api("/users/me", { method: "PATCH", body }),
  list: () => api("/users?limit=500"),
  get: (id) => api(`/users/${id}`),
  update: (id, body) => api(`/users/${id}`, { method: "PATCH", body }),
  remove: (id) => api(`/users/${id}`, { method: "DELETE" }),
  resetPassword: (id) => api(`/users/${id}/reset-password`, { method: "POST" }),
  forcePasswordChange: (id, signOut = true) => api(`/users/${id}/force-password-change`, { method: "POST", body: { signOut } }),
  signOutEverywhere: (id) => api(`/users/${id}/sign-out`, { method: "POST" }),
  updateAccess: (id, body) => api(`/users/${id}/access`, { method: "PUT", body }),
  createAgent: (body) => api("/users/agents", { method: "POST", body }),
  courseRepStatus: (department, level) =>
    api(
      `/users/course-rep-status?department=${encodeURIComponent(department)}&level=${encodeURIComponent(level)}`
    ),
};

export const documentsApi = {
  list: () => api("/documents"),
  get: (id) => api(`/documents/${id}`),
  create: (body) => api("/documents", { method: "POST", body }),
  update: (id, body) => api(`/documents/${id}`, { method: "PATCH", body }),
  approve: (id, body = { status: "approved" }) =>
    api(`/documents/${id}/approve`, { method: "POST", body }),
  remove: (id) => api(`/documents/${id}`, { method: "DELETE" }),
  requestDelete: (id, reason) => api(`/documents/${id}/delete-request`, { method: "POST", body: { reason } }),
};

export const announcementsApi = {
  list: () => api("/announcements"),
  create: (body) => api("/announcements", { method: "POST", body }),
  update: (id, body) => api(`/announcements/${id}`, { method: "PATCH", body }),
  remove: (id) => api(`/announcements/${id}`, { method: "DELETE" }),
  listReads: () => api("/announcements/reads"),
  markRead: (id) => api(`/announcements/${id}/read`, { method: "POST" }),
};

export const requestsApi = {
  list: () => api("/requests"),
  create: (body) => api("/requests", { method: "POST", body }),
  update: (id, body) => api(`/requests/${id}`, { method: "PATCH", body }),
  listProfileChanges: () => api("/profile-change-requests"),
  createProfileChange: (body) => api("/profile-change-requests", { method: "POST", body }),
  updateProfileChange: (id, body) => api(`/profile-change-requests/${id}`, { method: "PATCH", body }),
  removeProfileChange: (id) => api(`/profile-change-requests/${id}`, { method: "DELETE" }),
};

export const coursesApi = {
  list: () => api("/courses"),
  get: (id) => api(`/courses/${id}`),
  create: (body) => api("/courses", { method: "POST", body }),
  update: (id, body) => api(`/courses/${id}`, { method: "PATCH", body }),
  remove: (id) => api(`/courses/${id}`, { method: "DELETE" }),
};

export const notificationsApi = {
  create: (body) => api("/notifications", { method: "POST", body }),
  list: (archived = false) => api(`/notifications${archived ? "?archived=true" : ""}`),
  listAdmin: () => api("/notifications/admin"),
  markRead: (id) => api(`/notifications/${id}/read`, { method: "PATCH" }),
  markAdminRead: (id) => api(`/notifications/${id}/admin-read`, { method: "PATCH" }),
  markAllAdminRead: () => api("/notifications/admin/mark-all-read", { method: "POST" }),
  archive: (id) => api(`/notifications/${id}/archive`, { method: "PATCH" }),
  update: (id, body) => api(`/notifications/${id}/archive`, { method: "PATCH", body }),
  registerDeviceToken: (body) => api("/notifications/device-token", { method: "POST", body }),
  removeDeviceToken: (body) => api("/notifications/device-token", { method: "DELETE", body }),
  registerFcmToken: (body) => api("/notifications/fcm-token", { method: "POST", body }),
  removeFcmToken: (body) => api("/notifications/fcm-token", { method: "DELETE", body }),
};

export const departmentApi = {
  join: (body) => api("/department/join", { method: "POST", body }),
  me: (department) =>
    api(`/department/me${department ? `?department=${encodeURIComponent(department)}` : ""}`),
  members: ({ department, status } = {}) => {
    const params = new URLSearchParams();
    if (department) params.set("department", department);
    if (status) params.set("status", status);
    return api(`/department/members${params.toString() ? `?${params}` : ""}`);
  },
  admit: (id) => api(`/department/members/${id}/admit`, { method: "POST" }),
  reject: (id, reason) => api(`/department/members/${id}/reject`, { method: "POST", body: { reason } }),
  requestWithdraw: (id, reason) =>
    api(`/department/members/${id}/withdraw-request`, { method: "POST", body: { reason } }),
  reviewWithdraw: (id, action) =>
    api(`/department/members/${id}/withdraw-review`, { method: "POST", body: { action } }),
};

export const enrollmentsApi = {
  list: () => api("/enrollments"),
  create: (body) => api("/enrollments", { method: "POST", body }),
  update: (id, body) => api(`/enrollments/${id}`, { method: "PATCH", body }),
  remove: (id) => api(`/enrollments/${id}`, { method: "DELETE" }),
};

export const activityApi = {
  list: (params = "") => api(`/activity${params ? `?${params}` : ""}`),
  create: (body) => api("/activity", { method: "POST", body }),
  revert: (id) => api(`/activity/${id}/revert`, { method: "POST" }),
};

export const questionsApi = {
  list: () => api("/questions"),
  create: (body) => api("/questions", { method: "POST", body }),
  update: (id, body) => api(`/questions/${id}`, { method: "PATCH", body }),
  remove: (id) => api(`/questions/${id}`, { method: "DELETE" }),
};

export const timetableApi = {
  list: () => api("/timetable"),
  create: (body) => api("/timetable", { method: "POST", body }),
  update: (id, body) => api(`/timetable/${id}`, { method: "PATCH", body }),
  remove: (id) => api(`/timetable/${id}`, { method: "DELETE" }),
};

export const paymentsApi = {
  listClaims: () => api("/payments/claims"),
  createClaim: (body) => api("/payments/claims", { method: "POST", body }),
  approveClaim: (id) => api(`/payments/claims/${id}/approve`, { method: "PATCH" }),
};

export const settingsApi = {
  get: (key) => api(`/settings/${key}`),
  update: (key, body) => api(`/settings/${key}`, { method: "PUT", body }),
};

export const chatApi = {
  list: () => api("/chat"),
  markRead: () => api("/chat/read", { method: "POST" }),
  create: (body) => api("/chat", { method: "POST", body }),
  update: (id, body) => api(`/chat/${id}`, { method: "PATCH", body }),
};

export const classEventsApi = {
  comment: (id, text) => api(`/class-events/${id}/comments`, { method: "POST", body: { text } }),
  react: (id, type) => api(`/class-events/${id}/reactions`, { method: "POST", body: { type } }),
  reactComment: (id, commentId, type) => api(`/class-events/${id}/comments/${commentId}/reactions`, { method: "POST", body: { type } }),
  list: () => api("/class-events"),
  create: (body) => api("/class-events", { method: "POST", body }),
  update: (id, body) => api(`/class-events/${id}`, { method: "PATCH", body }),
  remove: (id) => api(`/class-events/${id}`, { method: "DELETE" }),
};

export const feedApi = {
  comment: (kind, id, text) => api(`/feed/${kind}/${id}/comments`, { method: "POST", body: { text } }),
  deleteComment: (kind, id, commentId) => api(`/feed/${kind}/${id}/comments/${commentId}`, { method: "DELETE" }),
  react: (kind, id, type) => api(`/feed/${kind}/${id}/reactions`, { method: "POST", body: { type } }),
  reactComment: (kind, id, commentId, type) => api(`/feed/${kind}/${id}/comments/${commentId}/reactions`, { method: "POST", body: { type } }),
  list: (kind, params = "") => api(`/feed/${kind}${params ? `?${params}` : ""}`),
  create: (kind, body) => api(`/feed/${kind}`, { method: "POST", body }),
  update: (kind, id, body) => api(`/feed/${kind}/${id}`, { method: "PATCH", body }),
  remove: (kind, id) => api(`/feed/${kind}/${id}`, { method: "DELETE" }),
};

export const subscriptionsApi = {
  count: () => api("/subscriptions/count"),
};

export const materialSavesApi = {
  list: () => api("/material-saves"),
  create: (body) => api("/material-saves", { method: "POST", body }),
  remove: (id) => api(`/material-saves/${id}`, { method: "DELETE" }),
};
// Generated quizzes from materials (student practice history)
export const quizzesApi = {
  listMine: () => api("/quizzes/mine"),
  listByMaterial: (materialId) =>
    api(`/quizzes?materialId=${encodeURIComponent(materialId)}`),
  create: (body) => api("/quizzes", { method: "POST", body }),
  get: (id) => api(`/quizzes/${id}`),
  update: (id, body) => api(`/quizzes/${id}`, { method: "PATCH", body }),
  // Reuse pool: existing AI questions for a material
  listMaterialQuestions: (materialId) =>
    api(`/questions?materialId=${encodeURIComponent(materialId)}`),
};
// Institutions → faculties → departments → programmes
const qs = (params = {}) => {
  const u = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "") u.set(k, String(v)); });
  const t = u.toString();
  return t ? `?${t}` : "";
};

/** A student's own course list (Enrollment rows) and the suggestions for their programme. */
export const myCoursesApi = {
  list: () => api("/me/courses"),
  suggestions: ({ legacy = false } = {}) => api(`/me/courses/suggestions${legacy ? "?legacy=1" : ""}`),
  add: (body) => api("/me/courses", { method: "POST", body }),
  addMany: (body) => api("/me/courses/bulk", { method: "POST", body }),
  remove: (id) => api(`/me/courses/${encodeURIComponent(id)}`, { method: "DELETE" }),
  searchCatalog: (params) => api(`/catalog/courses${qs(params)}`),
};

/** Admin: institutions → faculties → departments → programmes, courses and curricula. */
const A = "/admin/academics";
export const academicsApi = {
  summary: () => api(`${A}/summary`),
  institutions: (params) => api(`${A}/institutions${qs(params)}`),
  institution: (id) => api(`${A}/institutions/${encodeURIComponent(id)}`),
  createInstitution: (body) => api(`${A}/institutions`, { method: "POST", body }),
  updateInstitution: (id, body) => api(`${A}/institutions/${encodeURIComponent(id)}`, { method: "PATCH", body }),
  deleteInstitution: (id) => api(`${A}/institutions/${encodeURIComponent(id)}`, { method: "DELETE" }),
  faculties: (instId) => api(`${A}/institutions/${encodeURIComponent(instId)}/faculties`),
  createFaculty: (instId, body) => api(`${A}/institutions/${encodeURIComponent(instId)}/faculties`, { method: "POST", body }),
  updateFaculty: (id, body) => api(`${A}/faculties/${encodeURIComponent(id)}`, { method: "PATCH", body }),
  deleteFaculty: (id) => api(`${A}/faculties/${encodeURIComponent(id)}`, { method: "DELETE" }),
  departments: (facId) => api(`${A}/faculties/${encodeURIComponent(facId)}/departments`),
  createDepartment: (facId, body) => api(`${A}/faculties/${encodeURIComponent(facId)}/departments`, { method: "POST", body }),
  updateDepartment: (id, body) => api(`${A}/departments/${encodeURIComponent(id)}`, { method: "PATCH", body }),
  deleteDepartment: (id) => api(`${A}/departments/${encodeURIComponent(id)}`, { method: "DELETE" }),
  programmes: (depId) => api(`${A}/departments/${encodeURIComponent(depId)}/programmes`),
  createProgramme: (depId, body) => api(`${A}/departments/${encodeURIComponent(depId)}/programmes`, { method: "POST", body }),
  updateProgramme: (id, body) => api(`${A}/programmes/${encodeURIComponent(id)}`, { method: "PATCH", body }),
  deleteProgramme: (id) => api(`${A}/programmes/${encodeURIComponent(id)}`, { method: "DELETE" }),
  linkCurriculum: (progId, curriculumId) => api(`${A}/programmes/${encodeURIComponent(progId)}/curricula`, { method: "POST", body: { curriculumId } }),
  unlinkCurriculum: (progId, curId) => api(`${A}/programmes/${encodeURIComponent(progId)}/curricula/${encodeURIComponent(curId)}`, { method: "DELETE" }),
  departmentCourses: (depId) => api(`${A}/departments/${encodeURIComponent(depId)}/courses`),
  assignCourse: (depId, body) => api(`${A}/departments/${encodeURIComponent(depId)}/courses`, { method: "POST", body }),
  unassignCourse: (depId, linkId) => api(`${A}/departments/${encodeURIComponent(depId)}/courses/${encodeURIComponent(linkId)}`, { method: "DELETE" }),
  courses: (params) => api(`${A}/courses${qs(params)}`),
  course: (id) => api(`${A}/courses/${encodeURIComponent(id)}`),
  createCourse: (body) => api(`${A}/courses`, { method: "POST", body }),
  updateCourse: (id, body) => api(`${A}/courses/${encodeURIComponent(id)}`, { method: "PATCH", body }),
  archiveCourse: (id) => api(`${A}/courses/${encodeURIComponent(id)}/archive`, { method: "POST" }),
  restoreCourse: (id) => api(`${A}/courses/${encodeURIComponent(id)}/restore`, { method: "POST" }),
  deleteCourse: (id) => api(`${A}/courses/${encodeURIComponent(id)}`, { method: "DELETE" }),
  curricula: (params) => api(`${A}/curricula${qs(params)}`),
  curriculum: (id) => api(`${A}/curricula/${encodeURIComponent(id)}`),
  updateCurriculum: (id, body) => api(`${A}/curricula/${encodeURIComponent(id)}`, { method: "PATCH", body }),
};

/** Paginated, sortable staff user directory. */
export const directoryApi = {
  list: (params) => api(`/users${qs({ page: 1, ...params })}`),
};

export const institutionsApi = {
  search: ({ q = "", limit = 25, offset = 0, state = "" } = {}) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (state) params.set("state", state);
    params.set("limit", String(limit));
    params.set("offset", String(offset));
    return api(`/institutions?${params}`);
  },
  get: (id) => api(`/institutions/${encodeURIComponent(id)}`),
  tree: (id) => api(`/institutions/${encodeURIComponent(id)}/tree`),
};

// Study groups
export const groupsApi = {
  list: () => api("/groups"),
  discover: () => api("/groups/discover"),
  create: (body) => api("/groups", { method: "POST", body }),
  get: (id) => api(`/groups/${id}`),
  update: (id, body) => api(`/groups/${id}`, { method: "PATCH", body }),
  remove: (id) => api(`/groups/${id}`, { method: "DELETE" }),
  preview: (code) => api(`/groups/code/${encodeURIComponent(code)}`),
  join: (code) => api(`/groups/code/${encodeURIComponent(code)}/join`, { method: "POST" }),
  cancelRequest: (id) => api(`/groups/${id}/request`, { method: "DELETE" }),
  leave: (id) => api(`/groups/${id}/leave`, { method: "POST" }),
  transfer: (id, userId) => api(`/groups/${id}/transfer`, { method: "POST", body: { userId } }),
  markRead: (id) => api(`/groups/${id}/read`, { method: "POST" }),
  inviteScope: (id) => api(`/groups/${id}/invite-scope`, { method: "POST" }),
  members: (id, status = "active") => api(`/groups/${id}/members?status=${status}`),
  review: (id, userId, action) => api(`/groups/${id}/members/${userId}/review`, { method: "POST", body: { action } }),
  setRole: (id, userId, role) => api(`/groups/${id}/members/${userId}/role`, { method: "POST", body: { role } }),
  removeMember: (id, userId) => api(`/groups/${id}/members/${userId}`, { method: "DELETE" }),
  requestHistory: (id) => api(`/groups/${id}/history-request`, { method: "POST" }),
  reviewHistory: (id, userId, action) => api(`/groups/${id}/history-requests/${userId}`, { method: "POST", body: { action } }),
  messages: (id, { before, beforeId, after, limit } = {}) => {
    const params = new URLSearchParams();
    if (before) params.set("before", before);
    if (beforeId) params.set("beforeId", beforeId);
    if (after) params.set("after", after);
    if (limit) params.set("limit", String(limit));
    return api(`/groups/${id}/messages${params.toString() ? `?${params}` : ""}`);
  },
  send: (id, body) => api(`/groups/${id}/messages`, { method: "POST", body }),
  deleteMessage: (id, messageId) => api(`/groups/${id}/messages/${messageId}`, { method: "DELETE" }),
  saveMaterial: (id, messageId) => api(`/groups/${id}/messages/${messageId}/save`, { method: "POST" }),
};
