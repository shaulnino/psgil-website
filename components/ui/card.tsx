import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * ISL "Race Control" Card — an elevated dark panel: cream (dark) fill, 1px
 * hairline edge, sharp 2px corners, NO shadow / gradient / blur.
 * - `stamped`     → gold (brass) hairline for on-the-record content.
 * - `chamfer`     → chamfered "tech panel" corners (broadcast feature cards).
 *                   Rendered as a 1px-padded edge layer so the hairline follows
 *                   the diagonal cut.
 * - `cornerTicks` → gold race-control L-brackets at two corners.
 */
export function Card({
  className,
  stamped = false,
  chamfer = false,
  cornerTicks = false,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  stamped?: boolean;
  chamfer?: boolean;
  cornerTicks?: boolean;
}) {
  if (chamfer) {
    return (
      <div className={cn("isl-chamfer p-px", stamped ? "bg-brass" : "bg-hairline-strong")}>
        <div
          className={cn(
            "isl-chamfer h-full bg-cream",
            cornerTicks && "relative isl-corner-ticks",
            className,
          )}
          {...props}
        >
          {children}
        </div>
      </div>
    );
  }
  return (
    <div
      className={cn(
        "rounded-[2px] bg-cream",
        stamped ? "border border-brass" : "border border-hairline",
        cornerTicks && "relative isl-corner-ticks",
        className,
      )}
      {...props}
    >
      {children}
    </div>
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
