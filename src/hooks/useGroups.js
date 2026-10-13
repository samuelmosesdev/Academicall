import { useEffect, useSyncExternalStore } from "react";
import { groupsApi } from "../lib/api";
import { subscribe } from "../lib/realtime";

/**
 * Shared store for the signed-in student's study groups, so the sidebar badge
 * and the Groups page read the same data and update together in real time.
 */
const state = { meId: null, groups: [], totalUnread: 0, loading: true, error: "", loaded: false, activeGroupId: null };
const subs = new Set();
let inflight = null;
let timer = null;
let wired = false;
let generation = 0;
let snapshot = { ...state };

function commit(patch) {
  Object.assign(state, patch);
  snapshot = { ...state };
  subs.forEach((fn) => fn());
}

export async function refreshGroups() {
  const meId = state.meId;
  if (!meId || !localStorage.getItem("academicall_token")) return;
  if (inflight?.meId === meId && inflight.generation === generation) return inflight.promise;

  const request = { meId, generation, promise: null };
  const isCurrent = () => request.generation === generation && state.meId === request.meId;
  request.promise = groupsApi
    .list()
    .then(({ groups = [] }) => {
      if (!isCurrent()) return;
      // the open conversation is being read right now
      const list = groups.map((g) => (g.id === state.activeGroupId ? { ...g, unreadCount: 0 } : g));
      commit({ groups: list, totalUnread: list.reduce((n, g) => n + (g.unreadCount || 0), 0), loading: false, loaded: true, error: "" });
    })
    .catch((err) => {
      if (isCurrent()) commit({ loading: false, error: err.message || "Could not load your groups" });
    })
    .finally(() => {
      if (inflight === request) inflight = null;
    });
  inflight = request;
  return request.promise;
}

function refreshSoon(ms = 400) {
  clearTimeout(timer);
  timer = setTimeout(refreshGroups, ms);
}

function onMessage({ groupId, message } = {}) {
  if (!groupId || !message) return;
  const i = state.groups.findIndex((g) => g.id === groupId);
  if (i < 0) return refreshSoon();
  const g = state.groups[i];
  const mine = message.sender && message.sender.id === state.meId;
  const isActive = groupId === state.activeGroupId;
  const previewText =
    message.type === "image" ? "📷 Photo" : message.type === "video" ? "🎬 Video" : message.type === "document" ? `📄 ${message.attachment?.name || "Document"}` : message.text || "";
  const updated = {
    ...g,
    lastMessageAt: message.createdAt,
    lastMessagePreview: message.type === "text" || message.type === "system" ? message.text : previewText,
    lastMessageSender: message.type === "system" ? null : message.sender?.name || null,
    lastMessageType: message.type,
    unreadCount: isActive || mine || message.type === "system" ? g.unreadCount || 0 : (g.unreadCount || 0) + 1,
  };
  const groups = [updated, ...state.groups.filter((_, j) => j !== i)];
  commit({ groups, totalUnread: groups.reduce((n, x) => n + (x.unreadCount || 0), 0) });
}

function wire() {
  if (wired) return;
  wired = true;
  subscribe("group.message", onMessage);
  ["group.member", "group.updated", "group.removed", "group.request", "group.history", "reconnected", "poll"].forEach((t) => subscribe(t, () => refreshSoon()));
}

/** Mark which conversation is on screen (its unread count stays at zero). */
export function setActiveGroup(groupId, meId) {
  if (meId && state.meId !== meId) return;
  if (state.activeGroupId === groupId) return;
  const groups = state.groups.map((g) => (g.id === groupId ? { ...g, unreadCount: 0 } : g));
  commit({ activeGroupId: groupId, groups, totalUnread: groups.reduce((n, g) => n + (g.unreadCount || 0), 0) });
}

export function setGroupsAccount(meId) {
  const nextMeId = meId || null;
  if (state.meId === nextMeId) return;
  generation += 1;
  inflight = null;
  clearTimeout(timer);
  state.meId = nextMeId;
  commit({
    meId: nextMeId,
    groups: [],
    totalUnread: 0,
    loading: Boolean(nextMeId),
    loaded: false,
    error: "",
    activeGroupId: null,
  });
}

export function upsertGroup(group, expectedMeId = state.meId) {
  if (!expectedMeId || state.meId !== expectedMeId) return;
  const groups = [group, ...state.groups.filter((g) => g.id !== group.id)];
  commit({ groups, totalUnread: groups.reduce((n, g) => n + (g.unreadCount || 0), 0) });
}

export function dropGroup(groupId, expectedMeId = state.meId) {
  if (!expectedMeId || state.meId !== expectedMeId) return;
  const groups = state.groups.filter((g) => g.id !== groupId);
  commit({ groups, totalUnread: groups.reduce((n, g) => n + (g.unreadCount || 0), 0) });
}

export function useGroups(meId) {
  useEffect(() => {
    setGroupsAccount(meId);
    wire();
    if (!state.loaded) refreshGroups();
  }, [meId]);
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    () => snapshot,
    () => snapshot
  );
}
