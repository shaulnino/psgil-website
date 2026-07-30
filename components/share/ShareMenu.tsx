"use client";

/* ------------------------------------------------------------------ */
/*  ShareMenu — fallback UI when the native share sheet is unavailable  */
/*  ----------------------------------------------------------------  */
/*  Desktop  → compact popover (role="menu", Escape + outside-click).  */
/*  Mobile   → ISL Dialog sheet (native <dialog> focus trap for free). */
/*  Content  → Copy link + WhatsApp + Telegram + X + Email.            */
/*  Dark surface, restrained gold accent, monochrome line icons — no   */
/*  colourful social-widget styling. RTL-safe (logical properties).    */
/* ------------------------------------------------------------------ */

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Check, Copy, Mail, MessageCircle, Send } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { gaShare } from "@/lib/ga";
import { useShare } from "@/lib/share/useShare";
import {
  emailShareUrl,
  telegramShareUrl,
  whatsappShareUrl,
  xShareUrl,
} from "@/lib/share/shareUrls";
import type { SharePayload } from "@/lib/share/types";

export type SharePresentation = "popover" | "sheet";

/** The X (Twitter) wordmark as a monochrome inline glyph (currentColor). */
function XGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25h6.83l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

const itemClass =
  "flex w-full items-center gap-3 px-3 py-2.5 text-start font-isl-body text-sm text-ink-2 transition-colors hover:bg-cream hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[color:var(--isl-oxblood)]";

function ShareActions({
  payload,
  onDone,
}: {
  payload: SharePayload;
  onDone: () => void;
}) {
  const t = useTranslations("share");
  const { copy, copyStatus } = useShare(payload);

  const openExternal = (url: string, method: "whatsapp" | "telegram" | "x" | "email") => {
    if (method === "email") {
      window.location.href = url;
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
    gaShare({
      method,
      contentType: payload.contentType,
      contentId: payload.contentId,
      locale: payload.locale,
    });
    onDone();
  };

  const copyLabel =
    copyStatus === "copied"
      ? t("copied")
      : copyStatus === "error"
        ? t("copyFailed")
        : t("copyLink");

  return (
    <div role="menu" aria-orientation="vertical" className="flex flex-col py-1">
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          void copy();
        }}
        className={itemClass}
      >
        {copyStatus === "copied" ? (
          <Check className="h-4 w-4 shrink-0 text-status-success" strokeWidth={2} aria-hidden />
        ) : (
          <Copy className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
        )}
        <span aria-live="polite">{copyLabel}</span>
      </button>

      <button
        type="button"
        role="menuitem"
        onClick={() => openExternal(whatsappShareUrl(payload.text, payload.url), "whatsapp")}
        className={itemClass}
      >
        <MessageCircle className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
        <span>{t("whatsapp")}</span>
      </button>

      <button
        type="button"
        role="menuitem"
        onClick={() => openExternal(telegramShareUrl(payload.text, payload.url), "telegram")}
        className={itemClass}
      >
        <Send className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
        <span>{t("telegram")}</span>
      </button>

      <button
        type="button"
        role="menuitem"
        onClick={() => openExternal(xShareUrl(payload.text, payload.url), "x")}
        className={itemClass}
      >
        <XGlyph />
        <span>{t("x")}</span>
      </button>

      <button
        type="button"
        role="menuitem"
        onClick={() => openExternal(emailShareUrl(payload.title, payload.text, payload.url), "email")}
        className={itemClass}
      >
        <Mail className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
        <span>{t("email")}</span>
      </button>
    </div>
  );
}

export function ShareMenu({
  payload,
  presentation,
  onClose,
}: {
  payload: SharePayload;
  presentation: SharePresentation;
  onClose: () => void;
}) {
  const t = useTranslations("share");
  const panelRef = useRef<HTMLDivElement>(null);

  // Popover-only: Escape + outside-click dismissal, and focus the first item.
  useEffect(() => {
    if (presentation !== "popover") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    panelRef.current
      ?.querySelector<HTMLButtonElement>("button:not([disabled])")
      ?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [presentation, onClose]);

  if (presentation === "sheet") {
    return (
      <Dialog open onClose={onClose} title={t("heading")} closeLabel={t("close")}>
        <ShareActions payload={payload} onDone={onClose} />
      </Dialog>
    );
  }

  return (
    <div
      ref={panelRef}
      className="absolute end-0 top-full z-50 mt-2 min-w-[13rem] rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper shadow-[0_8px_24px_rgba(0,0,0,0.5)]"
    >
      <ShareActions payload={payload} onDone={onClose} />
    </div>
  );
}
