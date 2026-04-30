import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// ===== Registro condicional do Service Worker (PWA offline) =====
// Só registra fora do iframe da preview do Lovable e fora de domínios *.lovableproject.com,
// evitando que o SW intercepte navegação dentro do editor.
(() => {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  const isInIframe = (() => { try { return window.self !== window.top; } catch { return true; } })();
  const host = window.location.hostname;
  const isPreviewHost = host.includes("id-preview--") || host.includes("lovableproject.com");
  if (isInIframe || isPreviewHost) {
    // Em preview/iframe: garante que nenhum SW antigo continue ativo
    navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister())).catch(() => {});
    return;
  }
  // Produção/publish: registra via virtual module do vite-plugin-pwa
  import("virtual:pwa-register")
    .then(({ registerSW }) => {
      registerSW({ immediate: true, onRegisteredSW: () => console.info("[PWA] service worker ativo") });
    })
    .catch((e) => console.warn("[PWA] registro falhou", e));
})();
