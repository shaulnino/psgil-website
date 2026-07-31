"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { BellRing, BellOff } from "lucide-react";

/**
 * Push onboarding for the settings page (PW-4, Phase 2).
 *
 * Push is PWA-only by product decision, so the enable button only appears when
 * the app is running as an installed PWA (display-mode standalone / iOS
 * navigator.standalone). Otherwise we explain how to install. The control never
 * auto-prompts — the browser permission prompt only fires on the explicit click.
 */

type State =
  | "loading"
  | "unsupported"
  | "unconfigured"
  | "installRequired"
  | "denied"
  | "enabled"
  | "disabled"
  | "enabling"
  | "error";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const mm = window.matchMedia?.("(display-mode: standalone)")?.matches;
  const iosStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone;
  return !!mm || iosStandalone === true;
}

function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export default function PushControls() {
  const t = useTranslations("notifications");
  const [state, setState] = useState<State>("loading");

  const init = useCallback(async () => {
    if (!pushSupported()) {
      setState("unsupported");
      return;
    }
    // Confirm the server has VAPID configured.
    const cfg = await fetch("/api/notifications/push/public-key")
      .then((r) => r.json())
      .catch(() => ({ configured: false }));
    if (!cfg.configured) {
      setState("unconfigured");
      return;
    }
    if (!isStandalone()) {
      setState("installRequired");
      return;
    }
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }
    const reg = await navigator.serviceWorker.ready.catch(() => null);
    const existing = reg ? await reg.pushManager.getSubscription() : null;
    setState(existing ? "enabled" : "disabled");
  }, []);

  useEffect(() => {
    void init();
  }, [init]);

  const enable = useCallback(async () => {
    setState("enabling");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "disabled");
        return;
      }
      const cfg = await fetch("/api/notifications/push/public-key").then((r) => r.json());
      if (!cfg.configured || !cfg.publicKey) {
        setState("unconfigured");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(cfg.publicKey) as BufferSource,
      });
      const json = sub.toJSON();
      const res = await fetch("/api/notifications/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      });
      if (!res.ok) throw new Error("subscribe failed");
      setState("enabled");
    } catch {
      setState("error");
    }
  }, []);

  const disable = useCallback(async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/notifications/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        }).catch(() => {});
        await sub.unsubscribe().catch(() => {});
      }
      setState("disabled");
    } catch {
      setState("error");
    }
  }, []);

  const card = "rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream p-5 md:p-6";
  const heading = "font-isl-display text-lg font-bold tracking-[0.02em] text-ink";

  if (state === "loading") return null;

  return (
    <div className={card}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className={heading}>{t("push.title")}</h2>
          <p className="mt-1 text-sm text-meta">{t("push.description")}</p>
        </div>
        {(state === "disabled" || state === "enabling" || state === "error") && (
          <button
            type="button"
            onClick={enable}
            disabled={state === "enabling"}
            className="inline-flex shrink-0 items-center gap-2 rounded-[2px] bg-oxblood px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-oxblood-deep disabled:opacity-60"
          >
            <BellRing className="h-4 w-4" strokeWidth={2} aria-hidden />
            {state === "enabling" ? t("push.enabling") : t("push.enable")}
          </button>
        )}
        {state === "enabled" && (
          <button
            type="button"
            onClick={disable}
            className="inline-flex shrink-0 items-center gap-2 rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-ink"
          >
            <BellOff className="h-4 w-4" strokeWidth={2} aria-hidden />
            {t("push.disable")}
          </button>
        )}
      </div>

      {state === "enabled" && (
        <p className="mt-3 text-sm text-brass-ink">{t("push.enabled")}</p>
      )}
      {state === "denied" && <p className="mt-3 text-sm text-oxblood">{t("push.denied")}</p>}
      {state === "installRequired" && (
        <p className="mt-3 text-sm text-meta">{t("push.installRequired")}</p>
      )}
      {state === "unsupported" && (
        <p className="mt-3 text-sm text-meta">{t("push.unsupported")}</p>
      )}
      {state === "unconfigured" && (
        <p className="mt-3 text-sm text-meta">{t("push.unavailable")}</p>
      )}
      {state === "error" && <p className="mt-3 text-sm text-oxblood">{t("push.error")}</p>}
    </div>
  );
}
