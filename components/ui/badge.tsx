import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * ISL Badge — uppercase, tracked, small, sharp 2px. Ink outline or gold
 * (brass) hairline; never a heavy fill. `danger` (deep red) is errors only.
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-[2px] border px-2 py-0.5 font-isl-body text-[0.6875rem] font-semibold uppercase tracking-[0.14em] leading-none whitespace-nowrap",
  {
    variants: {
      variant: {
        ink: "border-hairline-strong text-ink-2",
        brass: "border-brass text-brass-ink",
        oxblood: "border-oxblood text-oxblood",
        danger: "border-[color:var(--isl-danger)] text-[color:var(--isl-danger)]",
      },
    },
    defaultVariants: { variant: "ink" },
  },
);

export function Badge({
  variant,
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { badgeVariants };
