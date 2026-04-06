import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

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
  import("virtual:pwa-register").then(({ registerSW }) => {
    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
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
  });
}

createRoot(document.getElementById("root")!).render(<App />);
