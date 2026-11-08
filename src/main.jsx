import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/fraunces/full.css";
import "@fontsource-variable/fraunces/full-italic.css";
import "@fontsource-variable/geist/index.css";
import "@fontsource-variable/geist-mono/index.css";
import "./index.css";
import "./dark-theme.css";
import "./billing.css";
import App from "./App.jsx";
import DialogProvider from "./components/ui/DialogProvider.jsx";
import { API_BASE } from "./lib/api";

try {
  const last = Number(sessionStorage.getItem("ac:warm") || 0);
  if (Date.now() - last > 4 * 60_000) {
    sessionStorage.setItem("ac:warm", String(Date.now()));
    fetch(`${API_BASE}/health`, { cache: "no-store" }).catch(() => {});
  }
} catch {
  // The API health check is optional when browser storage is unavailable.
}

let lastReloadAttempt = 0;
window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  const now = Date.now();
  if (now - lastReloadAttempt < 15_000) return;
  try {
    const previous = Number(sessionStorage.getItem("ac:reloaded") || 0);
    if (now - previous < 15_000) return;
    sessionStorage.setItem("ac:reloaded", String(now));
  } catch (error) {
    console.warn("Could not check stale-chunk reload guard", error);
    return;
  }
  lastReloadAttempt = now;
  window.location.reload();
});

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <DialogProvider>
      <App />
    </DialogProvider>
  </StrictMode>
);
