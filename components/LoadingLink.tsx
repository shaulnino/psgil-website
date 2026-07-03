"use client";

import NextLink from "next/link";
import { useRouter as useNextRouter } from "next/navigation";
import { Link as IntlLink, useRouter as useIntlRouter } from "@/i18n/navigation";
import {
  useState,
  useTransition,
  useCallback,
  type ReactNode,
  type MouseEvent,
  type AnchorHTMLAttributes,
} from "react";
import { gaClickJoinNow } from "@/lib/ga";

/**
 * Hrefs that must NOT be locale-prefixed: external, hash/anchor, the steward
 * portal (unprefixed by design), API, and mailto. Everything else is a public
 * content path and gets the active locale prefix via next-intl navigation.
 */
function isUnlocalizedHref(href: string): boolean {
  return (
    href.startsWith("http") ||
    href.startsWith("#") ||
    href.startsWith("/#") ||
    href.startsWith("/stewards") ||
    href.startsWith("/api") ||
    href.startsWith("mailto:")
  );
}

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
  /** Keep loading state but hide spinner (useful for logo links) */
  hideSpinner?: boolean;
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
  hideSpinner = false,
  ...rest
}: LoadingLinkProps) {
  const nextRouter = useNextRouter();
  const intlRouter = useIntlRouter();
  const [isPending, startTransition] = useTransition();
  const [isClicked, setIsClicked] = useState(false);

  const unlocalized = isUnlocalizedHref(href);
  const LinkComponent = unlocalized ? NextLink : IntlLink;
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
        if (unlocalized) nextRouter.push(href);
        else intlRouter.push(href);
      });

      // Safety: if transition doesn't resolve within 8s, re-enable
      setTimeout(() => setIsClicked(false), 8000);
    },
    [href, unlocalized, nextRouter, intlRouter, isLoading, externalOnClick, startTransition],
  );

  return (
    <LinkComponent
      href={href}
      onClick={handleClick}
      className={className}
      aria-busy={isLoading || undefined}
      aria-disabled={isLoading || undefined}
      {...rest}
    >
      {isLoading ? (
        hideSpinner ? (
          <span className="inline-flex items-center">{children}</span>
        ) : (
          <span className="inline-flex items-center gap-2">
            <Spinner className="h-4 w-4 shrink-0" />
            {showLoadingText ? (
              <span>Loading…</span>
            ) : (
              /* Render children dimmed so button width stays the same */
              <span className="opacity-60">{children}</span>
            )}
          </span>
        )
      ) : (
        children
      )}
    </LinkComponent>
  );
}

/* ---------- LoadingButton (for Button component) ---------- */
export type LoadingButtonProps = {
  href: string;
  children: ReactNode;
  className?: string;
  showLoadingText?: boolean;
  external?: boolean;
  onClick?: () => void;
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
  onClick,
}: LoadingButtonProps) {
  const isExternal = external ?? href.startsWith("http");
  const isHash = href.startsWith("#") || href.startsWith("/#");

  if (isHash) {
    return (
      <a href={href} className={className} onClick={() => onClick?.()}>
        {children}
      </a>
    );
  }

  if (isExternal) {
    const handleExternalClick = () => {
      // Auto-track Discord / join link clicks
      if (href.includes("discord")) gaClickJoinNow();
      onClick?.();
    };

    return (
      <a
        href={href}
        className={className}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleExternalClick}
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
