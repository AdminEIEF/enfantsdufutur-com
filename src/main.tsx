import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";

// --- Cache-busting & version detection ---
const APP_VERSION = Date.now().toString(); // changes on every build
const STORED_VERSION_KEY = "app_version";

async function clearAllCaches() {
  if ("caches" in window) {
    const names = await caches.keys();
    await Promise.all(names.map((n) => caches.delete(n)));
  }
}

async function unregisterAllSW() {
  if ("serviceWorker" in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
  }
}

// If version changed → nuke caches + SWs then hard reload
const previousVersion = localStorage.getItem(STORED_VERSION_KEY);
if (previousVersion && previousVersion !== APP_VERSION) {
  localStorage.setItem(STORED_VERSION_KEY, APP_VERSION);
  clearAllCaches()
    .then(unregisterAllSW)
    .then(() => location.reload());
} else {
  localStorage.setItem(STORED_VERSION_KEY, APP_VERSION);
}

// --- Iframe / preview guard ---
const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();
const isPreviewHost =
  window.location.hostname.includes("id-preview--") ||
  window.location.hostname.includes("lovableproject.com");

if (isPreviewHost || isInIframe) {
  navigator.serviceWorker?.getRegistrations().then((regs) => {
    regs.forEach((r) => r.unregister());
  });
}

// --- SW registration (production only) ---
if (import.meta.env.PROD && !isPreviewHost && !isInIframe && "serviceWorker" in navigator) {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      // Auto-accept updates
      void updateSW(true);
    },
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      const check = () => void registration.update().catch(() => undefined);
      check();
      window.addEventListener("focus", check);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") check();
      });
    },
  });
}

createRoot(document.getElementById("root")!).render(<App />);
