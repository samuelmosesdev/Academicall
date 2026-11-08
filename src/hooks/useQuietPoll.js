import { useEffect, useRef } from "react";

/**
 * Calls `callback` on a timer — but politely:
 *  - never while the tab is hidden (it catches up the moment the tab is visible again)
 *  - never more than once per `minGap`, even when focus + visibility events pile up
 *  - always the latest `callback`, without restarting the timer when it changes
 *
 * `callback` is expected to refresh data *silently* (no loading flags) and only
 * change state when the result differs from what is on screen.
 */
export function useQuietPoll(callback, { interval = 45_000, minGap = 8_000, enabled = true } = {}) {
  const saved = useRef(callback);
  useEffect(() => { saved.current = callback; }, [callback]);

  useEffect(() => {
    if (!enabled) return undefined;
    let last = Date.now();
    const run = (force = false) => {
      if (document.visibilityState === "hidden") return;
      const now = Date.now();
      if (!force && now - last < minGap) return;
      last = now;
      Promise.resolve()
        .then(() => saved.current?.())
        .catch((error) => console.error("Quiet background refresh failed", error));
    };
    const timer = setInterval(() => run(true), interval);
    const wake = () => run(false);
    window.addEventListener("focus", wake);
    document.addEventListener("visibilitychange", wake);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", wake);
      document.removeEventListener("visibilitychange", wake);
    };
  }, [interval, minGap, enabled]);
}
