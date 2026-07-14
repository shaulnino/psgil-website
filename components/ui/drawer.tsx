"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * ISL Drawer — an inline-end side sheet built on native `<dialog>` (focus trap,
 * Escape and inert backdrop for free). Full-height on desktop, full-width sheet
 * on mobile. Header (title + close), a scrollable body, and a sticky footer for
 * the primary action. RTL-safe: it docks to the inline-end edge in both dirs.
 */
export function Drawer({
  open,
  onClose,
  title,
  children,
  footer,
  closeLabel = "Close",
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
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
        "fixed inset-y-0 end-0 m-0 h-dvh max-h-dvh w-full max-w-md rounded-none border-s border-[color:var(--isl-hairline)] bg-paper p-0 text-ink",
        "backdrop:bg-black/70 open:animate-[f1-rise_0.3s_ease-out]",
      )}
    >
      {open && (
        <div className="flex h-dvh flex-col">
          <div className="flex items-center justify-between gap-4 border-b border-[color:var(--isl-hairline)] px-5 py-4">
            <h2 id={titleId} className="font-isl-display text-lg font-bold tracking-[0.01em] text-ink">
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
          <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
          {footer && (
            <div className="border-t border-[color:var(--isl-hairline)] px-5 py-4">{footer}</div>
          )}
        </div>
      )}
    </dialog>
  );
}
