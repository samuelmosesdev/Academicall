/**
 * Data saver: a per-device switch (Settings → Your data). When on, pages skip
 * cover pictures and previews and load question pictures only on demand.
 */
import { useEffect, useState } from "react";

const KEY = "ac.dataSaver";
const EVT = "ac:datasaver";

export const isDataSaver = () => {
  try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
};

export function setDataSaver(on) {
  try { localStorage.setItem(KEY, on ? "1" : "0"); } catch { /* private mode */ }
  document.documentElement.classList.toggle("data-saver", !!on);
  window.dispatchEvent(new Event(EVT));
}

if (typeof document !== "undefined") document.documentElement.classList.toggle("data-saver", isDataSaver());

export function useDataSaver() {
  const [on, setOn] = useState(isDataSaver);
  useEffect(() => {
    const f = () => setOn(isDataSaver());
    window.addEventListener(EVT, f);
    return () => window.removeEventListener(EVT, f);
  }, []);
  return [on, setDataSaver];
}
