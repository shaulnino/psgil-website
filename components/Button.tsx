"use client";

import { LoadingButton } from "@/components/LoadingLink";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "sm" | "md";

type ButtonProps = {
  href: string;
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  external?: boolean;
};

const baseStyles =
  "inline-flex items-center justify-center rounded-full font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7020B0]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0B0E]";

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-[#7020B0] text-white shadow-[0_0_20px_rgba(112,32,176,0.35)] hover:shadow-[0_0_28px_rgba(112,32,176,0.6)] hover:-translate-y-0.5",
  secondary:
    "border border-white/20 text-white/90 hover:border-[#7020B0]/60 hover:text-white hover:shadow-[0_0_16px_rgba(112,32,176,0.35)]",
  ghost: "text-white/80 hover:text-white hover:bg-white/5",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-6 text-sm md:text-base",
};

export default function Button({
  href,
  children,
  variant = "primary",
  size = "md",
  className = "",
  external,
}: ButtonProps) {
  const styles = `${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`;

  return (
    <LoadingButton href={href} className={styles} external={external}>
      {children}
    </LoadingButton>
  );
}
