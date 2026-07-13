import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * ISL "Race Control" form label — small uppercase tracked meta, like an
 * eyebrow above its field.
 */
export type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement>;

export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn(
        "mb-1.5 block font-isl-body text-xs font-semibold uppercase tracking-[0.14em] text-meta",
        className,
      )}
      {...props}
    />
  ),
);
Label.displayName = "Label";
