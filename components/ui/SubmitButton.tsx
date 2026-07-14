"use client";

import { useFormStatus } from "react-dom";
import { cn } from "@/lib/utils";

/**
 * Submit button for plain (server-action) `<form>`s that gives interactive
 * feedback: it disables itself and shows an inline spinner while the action is
 * pending (via `useFormStatus`), so users see that a press is doing something.
 * Pass the visual classes via `className` (keeps each form's existing styling).
 */
export default function SubmitButton({
  children,
  className = "",
  pendingText,
}: {
  children: React.ReactNode;
  className?: string;
  /** Optional label shown while pending (defaults to the normal children). */
  pendingText?: React.ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending || undefined}
      className={cn(
        "inline-flex items-center justify-center gap-2 transition-colors active:translate-y-px disabled:cursor-wait disabled:opacity-60",
        className,
      )}
    >
      {pending && (
        <svg className="h-3.5 w-3.5 shrink-0 animate-spin" viewBox="0 0 16 16" fill="none" aria-hidden>
          <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
          <path d="M14.5 8a6.5 6.5 0 00-6.5-6.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      )}
      <span>{pending && pendingText ? pendingText : children}</span>
    </button>
  );
}
