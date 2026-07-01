import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * ISL Card — a "clipping" pasted on the page: cream fill, 1px ink hairline,
 * sharp 2px corners, NO shadow / gradient / blur. Optional brass "case-stamp"
 * frame for on-the-record content (published verdicts, awards).
 */
export function Card({
  className,
  stamped = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { stamped?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-[2px] bg-cream",
        stamped ? "border border-brass" : "border border-hairline",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5 pb-3", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5 pt-0", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        "font-isl-display text-xl font-bold leading-[1.08] tracking-[0.005em] text-ink",
        className,
      )}
      {...props}
    />
  );
}
