import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * ISL Eyebrow — the small uppercase tracked label above headings/sections.
 * Oxblood by default (attention), or brass (on-the-record / earned).
 */
export function Eyebrow({
  className,
  tone = "oxblood",
  ...props
}: React.HTMLAttributes<HTMLParagraphElement> & { tone?: "oxblood" | "brass" | "meta" }) {
  const color =
    tone === "brass" ? "text-brass-ink" : tone === "meta" ? "text-meta" : "text-oxblood";
  return (
    <p
      className={cn(
        "font-isl-body text-[0.75rem] font-semibold uppercase tracking-[0.2em]",
        color,
        className,
      )}
      {...props}
    />
  );
}
