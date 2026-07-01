import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge conditional class names and de-duplicate conflicting Tailwind
 * utilities. Standard shadcn helper — used by the ISL primitive library
 * (components/ui/*, introduced in roadmap Phase 4).
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
