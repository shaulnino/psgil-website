import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * ISL "Race Control" Button (dark broadcast theme).
 * - primary   = gold fill / charcoal text (the press)
 * - secondary = gold hairline outline, no fill (gold text)
 * - ghost     = ink text becoming a gold rule on hover
 * Sharp 2px corners, no shadow, no glow. Logical properties for RTL.
 * Supports both <a href> and <button>.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-[2px] font-medium uppercase tracking-[0.08em] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--isl-oxblood)] disabled:opacity-50 disabled:pointer-events-none select-none",
  {
    variants: {
      variant: {
        primary: "bg-oxblood text-bone hover:bg-oxblood-deep",
        secondary:
          "border border-oxblood text-oxblood hover:border-oxblood-deep hover:text-oxblood-deep hover:bg-oxblood/10 bg-transparent",
        ghost:
          "text-ink bg-transparent border-b border-transparent hover:border-oxblood hover:text-oxblood",
      },
      size: {
        sm: "text-xs px-3 py-1.5",
        md: "text-sm px-4 py-2.5",
        lg: "text-[15px] px-6 py-3",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type CommonProps = VariantProps<typeof buttonVariants> & {
  className?: string;
  children: React.ReactNode;
};

type ButtonAsButton = CommonProps &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, keyof CommonProps> & {
    href?: undefined;
  };

type ButtonAsLink = CommonProps &
  Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, keyof CommonProps> & {
    href: string;
  };

export type ButtonProps = ButtonAsButton | ButtonAsLink;

export function Button({ variant, size, className, children, ...props }: ButtonProps) {
  const classes = cn(buttonVariants({ variant, size }), className);
  if ("href" in props && props.href !== undefined) {
    return (
      <a className={classes} {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}>
        {children}
      </a>
    );
  }
  return (
    <button className={classes} {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}>
      {children}
    </button>
  );
}

export { buttonVariants };
