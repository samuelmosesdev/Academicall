const API_BASE = "http://localhost:4000/api/v1";

function getToken() {
  return localStorage.getItem("academicall_token");
}

export async function api(endpoint, options = {}) {
  const token = getToken();

  const config = {
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
    ...options,
  };

  if (options.body && typeof options.body === "object") {
    config.body = JSON.stringify(options.body);
  }

  const res = await fetch(`${API_BASE}${endpoint}`, config);

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || data.message || "API request failed");
  }

  return data;
}

// Auth helpers
export const authApi = {
  register: (body) => api("/auth/register", { method: "POST", body }),
  login: (body) => api("/auth/login", { method: "POST", body }),
  me: () => api("/auth/me"),
};

// Other resources (ready for later)
export const usersApi = {
  me: () => api("/users/me"),
  updateMe: (body) => api("/users/me", { method: "PATCH", body }),
  list: () => api("/users"),
  get: (id) => api(`/users/${id}`),
};

export const documentsApi = {
  list: () => api("/documents"),
  get: (id) => api(`/documents/${id}`),
  create: (body) => api("/documents", { method: "POST", body }),
  update: (id, body) => api(`/documents/${id}`, { method: "PATCH", body }),
  remove: (id) => api(`/documents/${id}`, { method: "DELETE" }),
};

export const coursesApi = {
  list: () => api("/courses"),
  get: (id) => api(`/courses/${id}`),
  create: (body) => api("/courses", { method: "POST", body }),
};

export const notificationsApi = {
  list: () => api("/notifications"),
  markRead: (id) => api(`/notifications/${id}/read`, { method: "PATCH" }),
  archive: (id) => api(`/notifications/${id}/archive`, { method: "PATCH" }),
};