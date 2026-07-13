import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * ISL "Race Control" text input (dark broadcast theme).
 * Sunk surface, hairline border, gold focus ring, sharp 2px corners.
 * Logical padding for RTL. Pairs with <Label>.
 */
export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "w-full rounded-[2px] border border-[color:var(--isl-hairline-strong)] bg-sink px-3 py-2.5 text-sm text-ink",
        "placeholder:text-faint",
        "transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--isl-oxblood)]",
        "disabled:opacity-50 disabled:pointer-events-none",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
