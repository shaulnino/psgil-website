"use client";

/* ------------------------------------------------------------------ */
/*  useShare — native Web Share API + resilient clipboard fallback      */
/*  ----------------------------------------------------------------  */
/*  • Feature-detects navigator.share (SSR-safe).                      */
/*  • Swallows the user-cancel (AbortError); reports real failures so  */
/*    the caller can fall back to the platform menu.                   */
/*  • copy(): navigator.clipboard → execCommand fallback → error.      */
/*  • Fires GA share events (no-op when GA is disabled).               */
/* ------------------------------------------------------------------ */

import { useCallback, useEffect, useState } from "react";
import { gaShare } from "@/lib/ga";
import type { SharePayload } from "@/lib/share/types";

export type NativeShareResult = "shared" | "cancelled" | "unavailable";
export type CopyStatus = "idle" | "copied" | "error";

function isNativeShareSupported(): boolean {
  return (
    typeof navigator !== "undefined" && typeof navigator.share === "function"
  );
}

async function writeToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Permission denied / insecure context — fall through to legacy path.
  }
  // Legacy fallback (older iOS Safari, non-secure contexts).
  try {
    if (typeof document === "undefined") return false;
    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "");
    el.style.position = "fixed";
    el.style.top = "-9999px";
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}

export function useShare(payload: SharePayload) {
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");
  // Resolve support after mount so SSR and the first client render agree
  // (avoids hydration attribute mismatches on the trigger's ARIA state).
  const [canNativeShare, setCanNativeShare] = useState(false);
  useEffect(() => {
    setCanNativeShare(isNativeShareSupported());
  }, []);

  const nativeShare = useCallback(async (): Promise<NativeShareResult> => {
    if (!isNativeShareSupported()) return "unavailable";
    try {
      await navigator.share({
        title: payload.title,
        text: payload.text,
        url: payload.url,
      });
      gaShare({
        method: "native",
        contentType: payload.contentType,
        contentId: payload.contentId,
        locale: payload.locale,
      });
      return "shared";
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return "cancelled";
      // Any other failure: let the caller open the fallback menu.
      return "unavailable";
    }
  }, [payload]);

  const copy = useCallback(async (): Promise<boolean> => {
    const ok = await writeToClipboard(payload.url);
    setCopyStatus(ok ? "copied" : "error");
    if (ok) {
      gaShare({
        method: "copy",
        contentType: payload.contentType,
        contentId: payload.contentId,
        locale: payload.locale,
      });
    }
    window.setTimeout(() => setCopyStatus("idle"), 2200);
    return ok;
  }, [payload]);

  return { canNativeShare, nativeShare, copy, copyStatus };
}
