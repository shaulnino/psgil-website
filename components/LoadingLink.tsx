"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useState,
  useTransition,
  useCallback,
  type ReactNode,
  type MouseEvent,
  type AnchorHTMLAttributes,
} from "react";

/* ---------- Tiny CSS spinner ---------- */
function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="8"
        cy="8"
        r="6.5"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="2.5"
      />
      <path
        d="M14.5 8a6.5 6.5 0 00-6.5-6.5"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ---------- LoadingLink ---------- */
export type LoadingLinkProps = {
  /** Internal path — e.g. "/schedule" or "/drivers" */
  href: string;
  children: ReactNode;
  className?: string;
  /** Show "Loading…" text when navigating (default: false — spinner only) */
  showLoadingText?: boolean;
  /** Extra onClick handler (runs before navigation) */
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
} & Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  "href" | "onClick" | "children"
>;

/**
 * A Next.js `<Link>` wrapper that shows immediate loading feedback
 * (spinner + optional "Loading…") while the route transition is in progress.
 *
 * - Uses `useTransition` so the spinner clears once the new route renders.
 * - Prevents double-click navigation.
 * - No layout shift: spinner replaces the label in the same flex container.
 * - Accessibility: adds `aria-busy` and `aria-disabled` while loading.
 */
export default function LoadingLink({
  href,
  children,
  className = "",
  showLoadingText = false,
  onClick: externalOnClick,
  ...rest
}: LoadingLinkProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isClicked, setIsClicked] = useState(false);

  const isLoading = isPending || isClicked;

  const handleClick = useCallback(
    (e: MouseEvent<HTMLAnchorElement>) => {
      // Let external onClick run first
      externalOnClick?.(e);
      if (e.defaultPrevented) return;

      // Prevent double-click
      if (isLoading) {
        e.preventDefault();
        return;
      }

      // Prevent default Link behaviour — we drive navigation via router.push
      e.preventDefault();
      setIsClicked(true);

      startTransition(() => {
        router.push(href);
      });

      // Safety: if transition doesn't resolve within 8s, re-enable
      setTimeout(() => setIsClicked(false), 8000);
    },
    [href, router, isLoading, externalOnClick, startTransition],
  );

  return (
    <Link
      href={href}
      onClick={handleClick}
      className={className}
      aria-busy={isLoading || undefined}
      aria-disabled={isLoading || undefined}
      {...rest}
    >
      {isLoading ? (
        <span className="inline-flex items-center gap-2">
          <Spinner className="h-4 w-4 shrink-0" />
          {showLoadingText ? (
            <span>Loading…</span>
          ) : (
            /* Render children dimmed so button width stays the same */
            <span className="opacity-60">{children}</span>
          )}
        </span>
      ) : (
        children
      )}
    </Link>
  );
}

/* ---------- LoadingButton (for Button component) ---------- */
export type LoadingButtonProps = {
  href: string;
  children: ReactNode;
  className?: string;
  showLoadingText?: boolean;
  external?: boolean;
};

/**
 * Drop-in replacement for the existing `Button` component that adds
 * loading feedback for internal navigation. External links pass through
 * as regular `<a>` tags with no loading state.
 */
export function LoadingButton({
  href,
  children,
  className = "",
  showLoadingText = false,
  external,
}: LoadingButtonProps) {
  const isExternal = external ?? href.startsWith("http");

  if (isExternal) {
    return (
      <a
        href={href}
        className={className}
        target="_blank"
        rel="noopener noreferrer"
      >
        {children}
      </a>
    );
  }

  return (
    <LoadingLink
      href={href}
      className={className}
      showLoadingText={showLoadingText}
    >
      {children}
    </LoadingLink>
  );
}
