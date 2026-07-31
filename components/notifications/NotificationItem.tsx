"use client";

import NextLink from "next/link";
import { useTranslations } from "next-intl";
import {
  Bell,
  CalendarCheck,
  Flag,
  Gavel,
  Megaphone,
  Newspaper,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { NotificationCategory, UserNotification } from "@/lib/notifications/types";
import { relativeTime, renderNotification } from "@/components/notifications/render";

const CATEGORY_ICON: Record<NotificationCategory, LucideIcon> = {
  attendance: CalendarCheck,
  race: Flag,
  steward: Gavel,
  articles: Newspaper,
  results: Trophy,
  admin: Megaphone,
};

/** Left accent + unread-dot colour by priority (not colour-only: an explicit
 *  unread dot + bold title also signal state). */
const PRIORITY_ACCENT: Record<UserNotification["priority"], string> = {
  critical: "bg-oxblood",
  important: "bg-brass",
  standard: "bg-meta/50",
  low: "bg-meta/40",
};

export default function NotificationItem({
  n,
  onNavigate,
}: {
  n: UserNotification;
  onNavigate?: () => void;
}) {
  const t = useTranslations("notifications");
  const { title, body } = renderNotification(t, n);
  const Icon = CATEGORY_ICON[n.category] ?? Bell;
  const unread = !n.readAt;

  const handleClick = () => {
    // Fire-and-forget: mark read/clicked; navigation proceeds via the link.
    void fetch("/api/notifications/click", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: n.id }),
    }).catch(() => {});
    onNavigate?.();
  };

  const inner = (
    <div className="flex items-start gap-3">
      <span
        className={cn(
          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream text-ink",
        )}
        aria-hidden
      >
        <Icon className="h-4 w-4" strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm text-ink", unread ? "font-semibold" : "font-medium")}>{title}</p>
        <p className="mt-0.5 line-clamp-2 text-xs text-meta">{body}</p>
        <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.12em] text-faint">
          {relativeTime(t, n.createdAt)}
        </p>
      </div>
      {unread && (
        <span
          className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", PRIORITY_ACCENT[n.priority])}
          aria-label={t("labels.unread")}
        />
      )}
    </div>
  );

  const className = cn(
    "relative block border-s-2 px-4 py-3 transition-colors hover:bg-cream focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[color:var(--isl-oxblood)]",
    unread ? "border-s-oxblood bg-paper" : "border-s-transparent bg-transparent",
  );

  // Steward routes live outside the [locale] segment, so use a plain link for
  // them and the locale-aware Link for everything else.
  return n.localized ? (
    <Link href={n.deepLink} onClick={handleClick} className={className}>
      {inner}
    </Link>
  ) : (
    <NextLink href={n.deepLink} onClick={handleClick} className={className}>
      {inner}
    </NextLink>
  );
}
