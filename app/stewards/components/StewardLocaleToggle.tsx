"use client";

import { useTransition } from "react";
import { setStewardLocaleAction } from "@/app/stewards/actions";

/**
 * Self-service HE/EN toggle for the steward portal (Phase 9e). Persists the
 * choice to the steward's own user record, then does a full reload so the
 * shared root <html lang/dir> + all server/client translations pick up the new
 * language (the portal is unprefixed, so this is a preference, not a URL change).
 */
export default function StewardLocaleToggle({ locale }: { locale: "en" | "he" }) {
  const [pending, startTransition] = useTransition();
  const target: "en" | "he" = locale === "he" ? "en" : "he";
  const label = locale === "he" ? "EN" : "עברית";
  const aria = locale === "he" ? "Switch portal to English" : "החלפת הממשק לעברית";

  return (
    <button
      type="button"
      disabled={pending}
      aria-label={aria}
      onClick={() =>
        startTransition(async () => {
          await setStewardLocaleAction(target);
          window.location.reload();
        })
      }
      className="rounded-[2px] border border-[color:var(--isl-hairline)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink-2 transition-colors hover:border-ink hover:text-ink disabled:opacity-60"
    >
      {label}
    </button>
  );
}
