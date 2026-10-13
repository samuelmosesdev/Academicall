/**
 * One live connection per tab to GET /realtime/stream (Server-Sent Events).
 *
 * Streams with fetch() so the JWT travels in the Authorization header (never in
 * a URL). Reconnects with backoff, pauses while offline, and emits a synthetic
 * "reconnected" event so screens can fetch anything they missed while down.
 *
 *   const off = subscribe("group.message", (data) => ...);
 *   useRealtime(["programme.post", "reconnected"], handler);
 *   const status = useRealtimeStatus(); // "connecting" | "live" | "offline"
 */
import { useEffect, useRef, useSyncExternalStore } from "react";
import { API_BASE } from "./api";

const listeners = new Map(); // type -> Set<fn>
const statusListeners = new Set();
let status = "offline";
let controller = null;
let retry = 0;
let retryTimer = null;
let pollTimer = null;
let started = false;
let everConnected = false;
let lastEventAt = 0;

const BACKOFF = [1000, 2000, 4000, 8000, 15000, 30000];
const STALE_MS = 70_000; // server pings every 25 s; two missed pings = dead link
const FALLBACK_POLL_MS = 30_000;

function token() {
  return localStorage.getItem("academicall_token");
}

function setStatus(next) {
  if (status === next) return;
  status = next;
  statusListeners.forEach((fn) => fn());
}

function emit(type, data) {
  for (const key of [type, "*"]) {
    listeners.get(key)?.forEach((fn) => {
      try {
        fn(data, type);
      } catch (err) {
        console.error("[realtime] listener failed", err);
      }
    });
  }
}

function scheduleReconnect() {
  clearTimeout(retryTimer);
  if (!started || !token()) return;
  const wait = BACKOFF[Math.min(retry, BACKOFF.length - 1)] + Math.round(Math.random() * 400);
  retry += 1;
  retryTimer = setTimeout(connect, wait);
}

async function connect() {
  clearTimeout(retryTimer);
  controller?.abort();
  const jwt = token();
  if (!started || !jwt) {
    setStatus("offline");
    return;
  }
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    setStatus("offline");
    return; // the "online" event restarts us
  }
  const ctrl = new AbortController();
  controller = ctrl;
  setStatus("connecting");
  try {
    const res = await fetch(`${API_BASE}/realtime/stream`, {
      headers: { Authorization: `Bearer ${jwt}`, Accept: "text/event-stream" },
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (res.status === 401) {
      setStatus("offline");
      return; // signed out or token expired; AuthContext handles it
    }
    if (!res.ok || !res.body) throw new Error(`stream ${res.status}`);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      lastEventAt = Date.now();
      buffer += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buffer.indexOf("\n\n")) >= 0) {
        const chunk = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        let type = "message";
        const data = [];
        for (const line of chunk.split("\n")) {
          if (line.startsWith("event:")) type = line.slice(6).trim();
          else if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
        }
        if (!data.length) continue; // comment / ping
        let payload = null;
        try {
          payload = JSON.parse(data.join("\n"));
        } catch {
          payload = data.join("\n");
        }
        if (type === "ready") {
          const wasDown = everConnected;
          everConnected = true;
          retry = 0;
          setStatus("live");
          if (wasDown) emit("reconnected", payload);
          continue;
        }
        emit(type, payload);
      }
    }
    throw new Error("stream closed");
  } catch (err) {
    if (ctrl.signal.aborted) return;
    console.warn("[realtime] stream disconnected; retrying", err);
    setStatus(navigator.onLine === false ? "offline" : "connecting");
    scheduleReconnect();
  }
}

function watchdog() {
  if (status === "live" && Date.now() - lastEventAt > STALE_MS) connect();
}

/** Start (or restart after sign-in). Safe to call repeatedly. */
export function startRealtime() {
  if (typeof window === "undefined") return;
  if (!started) {
    started = true;
    window.addEventListener("online", () => connect());
    window.addEventListener("offline", () => {
      controller?.abort();
      setStatus("offline");
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && status !== "live") connect();
    });
    setInterval(watchdog, 20_000);
    pollTimer = setInterval(() => {
      if (
        started &&
        status !== "live" &&
        token() &&
        (typeof navigator === "undefined" || navigator.onLine !== false)
      ) {
        emit("poll", { at: Date.now() });
      }
    }, FALLBACK_POLL_MS);
  }
  retry = 0;
  connect();
}

export function stopRealtime() {
  started = false;
  everConnected = false;
  clearTimeout(retryTimer);
  clearInterval(pollTimer);
  pollTimer = null;
  controller?.abort();
  controller = null;
  setStatus("offline");
}

export function subscribe(type, fn) {
  if (!listeners.has(type)) listeners.set(type, new Set());
  listeners.get(type).add(fn);
  return () => listeners.get(type)?.delete(fn);
}

export function getRealtimeStatus() {
  return status;
}

export function useRealtimeStatus() {
  return useSyncExternalStore(
    (cb) => {
      statusListeners.add(cb);
      return () => statusListeners.delete(cb);
    },
    () => status,
    () => "offline"
  );
}

/** Subscribe a component to one or more event types; the handler may change between renders. */
export function useRealtime(types, handler) {
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  const key = Array.isArray(types) ? types.join("|") : types;
  useEffect(() => {
    const list = key.split("|");
    const offs = list.map((t) => subscribe(t, (data, type) => ref.current?.(data, type)));
    return () => offs.forEach((off) => off());
  }, [key]);
}
