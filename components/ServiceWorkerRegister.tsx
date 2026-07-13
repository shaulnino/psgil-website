"use client";

import { useEffect } from "react";

/**
 * Registers the F1ISL service worker (PW-1).
 *
 * Production-only on purpose: a service worker's caching makes local dev
 * confusing (stale assets, hard reloads), and it isn't needed there. Renders
 * nothing — it's a mount-time side effect.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Registration failures are non-fatal — the site works without the SW.
      });
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return null;
}
