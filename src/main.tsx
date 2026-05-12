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

// SW registration is handled centrally by <UpdateBanner /> so the user
// gets a visible "new version available" prompt instead of a silent reload.

createRoot(document.getElementById("root")!).render(<App />);
