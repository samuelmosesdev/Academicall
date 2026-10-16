import { api } from "./api";

export const NEWS_CATEGORIES = ["Campus", "Admissions", "Exams", "Scholarships", "Sports", "Tech", "Opinion", "Events"];
export const REACTIONS = [
  { type: "like", emoji: "👍", label: "Like" },
  { type: "love", emoji: "❤️", label: "Love" },
  { type: "fire", emoji: "🔥", label: "Fire" },
  { type: "clap", emoji: "👏", label: "Applause" },
  { type: "wow", emoji: "😮", label: "Wow" },
];

const qs = (o) => {
  const p = new URLSearchParams();
  Object.entries(o).forEach(([k, v]) => v !== undefined && v !== null && v !== "" && p.set(k, v));
  const s = p.toString();
  return s ? `?${s}` : "";
};

export const newsApi = {
  list: ({ category, q, before, offset, limit } = {}) => api(`/news${qs({ category, q, before, offset, limit })}`),
  suggest: (q, opts) => api(`/news/suggest${qs({ q })}`, opts),
  forYou: () => api("/news/for-you"),
  subscriptions: () => api("/news/subscriptions"),
  follow: (kind, value, label) => api("/news/subscriptions", { method: "POST", body: { kind, value, label } }),
  unfollow: (id) => api(`/news/subscriptions/${id}`, { method: "DELETE" }),
  alerts: (newsAlerts) => api("/news/subscriptions/prefs", { method: "PATCH", body: { newsAlerts } }),
  get: (slug) => api(`/news/${encodeURIComponent(slug)}`),
  comments: (postId) => api(`/news/${postId}/comments`),
  comment: (postId, body) => api(`/news/${postId}/comments`, { method: "POST", body: { body } }),
  deleteComment: (commentId) => api(`/news/comments/${commentId}`, { method: "DELETE" }),
  react: (postId, type) => api(`/news/${postId}/reactions`, { method: "POST", body: { type } }),
  desk: () => api("/news/desk/posts"),
  create: (body) => api("/news/desk/posts", { method: "POST", body }),
  update: (id, body) => api(`/news/desk/posts/${id}`, { method: "PATCH", body }),
  remove: (id) => api(`/news/desk/posts/${id}`, { method: "DELETE" }),
};

/** Chief News Agent tools. */
export const chiefApi = {
  overview: () => api("/news/chief/overview"),
  posts: (params = {}) => api(`/news/chief/posts${qs(params)}`),
  moderate: (id, action, note) => api(`/news/chief/posts/${id}`, { method: "PATCH", body: { action, note } }),
  remove: (id, reason) => api(`/news/chief/posts/${id}`, { method: "DELETE", body: { reason } }),
  agents: () => api("/news/chief/agents"),
  setAgent: (id, newsStatus, reason) => api(`/news/chief/agents/${id}`, { method: "PATCH", body: { newsStatus, reason } }),
  removeDuty: (id) => api(`/news/chief/agents/${id}/duty`, { method: "DELETE" }),
};

export function timeAgo(date) {
  if (!date) return "";
  const s = Math.max(1, Math.round((Date.now() - new Date(date).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(date).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

export function longDate(date) {
  return date ? new Date(date).toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "long", year: "numeric" }) : "";
}
