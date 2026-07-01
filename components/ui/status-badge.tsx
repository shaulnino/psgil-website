import * as React from "react";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * ISL StatusBadge — the shape-first status token. Meaning is carried by
 * SHAPE (a Lucide glyph) + LABEL + fixed position; hue is only confirmation.
 * This is what lets the 6+ steward statuses stay distinguishable on a
 * one-accent palette, in grayscale/print, and for colour-blind stewards.
 */
export type StatusTone =
  | "info"
  | "warning"
  | "success"
  | "danger"
  | "brass"
  | "bronze"
  | "muted";

const toneClass: Record<StatusTone, string> = {
  info: "text-status-info border-status-info",
  warning: "text-status-warning border-status-warning",
  success: "text-status-success border-status-success",
  danger: "text-status-danger border-status-danger",
  brass: "text-brass-ink border-brass",
  bronze: "text-bronze-ink border-bronze-ink",
  muted: "text-meta border-hairline-strong",
};

export function StatusBadge({
  icon: Icon,
  tone,
  children,
  className,
}: {
  icon: LucideIcon;
  tone: StatusTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[2px] border px-2 py-1 font-isl-body text-[0.6875rem] font-semibold uppercase tracking-[0.12em] leading-none",
        toneClass[tone],
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
      {children}
    </span>
  );
}
