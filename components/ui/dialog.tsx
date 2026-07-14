"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * ISL "Race Control" Dialog — a generic native `<dialog>` modal (the sanctioned
 * modal pattern, generalized from SuccessModal). Native `showModal()` gives us a
 * focus trap, Escape-to-close and an inert backdrop for free; we add backdrop
 * click-to-close and a titled header with a close button. Sharp 2px corners,
 * hairline edge, no glow. RTL-safe (logical properties + `end-*`).
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
  className,
  closeLabel = "Close",
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  closeLabel?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const handleClose = () => onClose();
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [onClose]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        "fixed inset-0 z-50 m-auto w-[calc(100vw-2rem)] max-w-md rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper p-0 text-ink backdrop:bg-black/70 open:animate-[f1-rise_0.35s_ease-out]",
        className,
      )}
    >
      {open && (
        <div className="flex flex-col">
          <div className="flex items-center justify-between gap-4 border-b border-[color:var(--isl-hairline)] px-5 py-3.5">
            <h2
              id={titleId}
              className="font-isl-display text-lg font-bold tracking-[0.01em] text-ink"
            >
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label={closeLabel}
              className="-me-1.5 rounded-[2px] p-1.5 text-meta transition-colors hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--isl-oxblood)]"
            >
              <X className="h-4 w-4" strokeWidth={2} aria-hidden />
            </button>
          </div>
          <div className="px-5 py-4">{children}</div>
        </div>
      )}
    </dialog>
  );
}
