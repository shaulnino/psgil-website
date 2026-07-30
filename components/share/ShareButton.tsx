"use client";

/* ------------------------------------------------------------------ */
/*  ShareButton — the single, compact ISL share affordance             */
/*  ----------------------------------------------------------------  */
/*  Primary action: native OS share sheet when available (mobile/PWA + */
/*  Safari/Edge desktop). Otherwise falls back to <ShareMenu> — a      */
/*  popover on desktop, a Dialog sheet on mobile.                      */
/*  Two visual variants: "labeled" (gold outline button) and "icon".   */
/*  All copy is translated; RTL-safe via logical properties.           */
/* ------------------------------------------------------------------ */

import { useCallback, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useShare } from "@/lib/share/useShare";
import { ShareMenu, type SharePresentation } from "@/components/share/ShareMenu";
import type { SharePayload } from "@/lib/share/types";

type ShareButtonProps = {
  payload: SharePayload;
  variant?: "icon" | "labeled";
  className?: string;
};

export default function ShareButton({
  payload,
  variant = "labeled",
  className,
}: ShareButtonProps) {
  const t = useTranslations("share");
  const { canNativeShare, nativeShare } = useShare(payload);
  const [menuOpen, setMenuOpen] = useState(false);
  const [presentation, setPresentation] = useState<SharePresentation>("popover");
  const triggerRef = useRef<HTMLButtonElement>(null);

  const handleClick = useCallback(async () => {
    if (menuOpen) {
      setMenuOpen(false);
      return;
    }
    // Choose the fallback surface from the viewport at click time.
    const isMobile =
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 767px)").matches;
    setPresentation(isMobile ? "sheet" : "popover");

    const result = await nativeShare();
    // "shared" / "cancelled" → nothing more to do. Only open the fallback menu
    // when the native sheet isn't available (or errored).
    if (result === "unavailable") setMenuOpen(true);
  }, [menuOpen, nativeShare]);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    triggerRef.current?.focus();
  }, []);

  const ariaLabel = t("ariaLabel", { title: payload.title });

  return (
    <div className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        onClick={handleClick}
        aria-haspopup={!canNativeShare ? "menu" : undefined}
        aria-expanded={!canNativeShare ? menuOpen : undefined}
        aria-label={variant === "icon" ? ariaLabel : undefined}
        title={variant === "icon" ? t("button") : undefined}
        className={cn(
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--isl-oxblood)]",
          variant === "icon"
            ? "inline-flex h-11 w-11 items-center justify-center rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper text-ink-2 transition-colors hover:border-oxblood hover:text-oxblood"
            : "inline-flex items-center gap-2 rounded-[2px] border border-oxblood bg-transparent px-4 py-2.5 text-sm font-medium uppercase tracking-[0.08em] text-oxblood transition-colors hover:bg-oxblood/10 hover:text-oxblood-deep active:translate-y-px",
          className,
        )}
      >
        <Share2 className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
        {variant === "labeled" && <span>{t("button")}</span>}
      </button>

      {menuOpen && (
        <ShareMenu payload={payload} presentation={presentation} onClose={closeMenu} />
      )}
    </div>
  );
}
