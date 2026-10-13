const API_BASE = (
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV
    ? "http://localhost:4000/api/v1"
    : "https://academicall-api-1.onrender.com/api/v1")
).replace(/\/$/, "");
const API_TIMEOUT_MS = 60000;
const AUTH_RETRYABLE_ENDPOINTS = new Set(["/auth/login", "/auth/google"]);

async function fetchWithRetry(url, config, endpoint) {
  const attempts = AUTH_RETRYABLE_ENDPOINTS.has(endpoint) && !config.signal ? 2 : 1;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
    try {
      return await fetch(url, {
        ...config,
        signal: config.signal || controller.signal,
      });
    } catch (error) {
      const retryable = error instanceof TypeError || error.name === "AbortError";
      if (attempt + 1 < attempts && retryable) {
        await new Promise((resolve) => window.setTimeout(resolve, 1000));
        continue;
      }
      if (error.name === "AbortError") {
        throw new Error("The sign-in server is taking too long to respond. Please try again in a moment.");
      }
      if (error instanceof TypeError) {
        throw new Error("Unable to reach the sign-in server. Check your connection and try again.");
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

function getToken() {
  return localStorage.getItem("academicall_token");
}

export async function api(endpoint, options = {}) {
  const token = getToken();

  const config = {
    ...options,
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
    const res = await fetchWithRetry(`${API_BASE}${endpoint}`, config, endpoint);
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error("API Error Response:", data);
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
    throw err;
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
  list: () => api("/users"),
  get: (id) => api(`/users/${id}`),
  update: (id, body) => api(`/users/${id}`, { method: "PATCH", body }),
  remove: (id) => api(`/users/${id}`, { method: "DELETE" }),
  resetPassword: (id) => api(`/users/${id}/reset-password`, { method: "POST" }),
  createAgent: (body) => api("/users/agents", { method: "POST", body }),
  courseRepStatus: (program, level) =>
    api(
      `/users/course-rep-status?program=${encodeURIComponent(program)}&level=${encodeURIComponent(level)}`
    ),
};

export const documentsApi = {
  list: () => api("/documents"),
  mine: () => api("/documents/mine"),
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
  me: (program) =>
    api(`/department/me${program ? `?program=${encodeURIComponent(program)}` : ""}`),
  members: ({ program, status } = {}) => {
    const params = new URLSearchParams();
    if (program) params.set("program", program);
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
  list: () => api("/class-events"),
  create: (body) => api("/class-events", { method: "POST", body }),
  update: (id, body) => api(`/class-events/${id}`, { method: "PATCH", body }),
  remove: (id) => api(`/class-events/${id}`, { method: "DELETE" }),
};

export const feedApi = {
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