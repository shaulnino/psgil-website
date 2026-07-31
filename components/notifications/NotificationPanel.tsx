"use client";

import { useTranslations } from "next-intl";
import { CheckCheck, Settings } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { UserNotification } from "@/lib/notifications/types";
import NotificationItem from "@/components/notifications/NotificationItem";

/** Presentational panel body shared by the desktop popover and the mobile
 *  drawer. State (fetching, mark-all-read, navigation) is owned by the bell. */
export default function NotificationPanel({
  items,
  unread,
  loading,
  hideTitle = false,
  onMarkAllRead,
  onNavigate,
}: {
  items: UserNotification[];
  unread: number;
  loading: boolean;
  /** In the mobile drawer the sheet chrome already shows a title. */
  hideTitle?: boolean;
  onMarkAllRead: () => void;
  onNavigate: () => void;
}) {
  const t = useTranslations("notifications");

  return (
    <div className="flex h-full flex-col">
      {(!hideTitle || unread > 0) && (
        <div className="flex items-center justify-between gap-3 border-b border-[color:var(--isl-hairline)] px-4 py-2.5">
          {hideTitle ? (
            <span />
          ) : (
            <p className="font-isl-body text-[11px] font-semibold uppercase tracking-[0.2em] text-brass-ink">
              {t("bell.title")}
            </p>
          )}
          {unread > 0 && (
            <button
              type="button"
              onClick={onMarkAllRead}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-meta transition-colors hover:text-oxblood-deep"
            >
              <CheckCheck className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
              {t("bell.markAllRead")}
            </button>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {loading && items.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-meta">{t("bell.loading")}</p>
        ) : items.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-meta">{t("bell.empty")}</p>
        ) : (
          <ul className="divide-y divide-[color:var(--isl-hairline)]">
            {items.map((n) => (
              <li key={n.id}>
                <NotificationItem n={n} onNavigate={onNavigate} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-[color:var(--isl-hairline)] px-4 py-2.5">
        <Link
          href="/notifications"
          onClick={onNavigate}
          className="text-[11px] font-medium text-meta transition-colors hover:text-oxblood-deep"
        >
          {t("bell.viewAll")}
        </Link>
        <Link
          href="/account/notifications"
          onClick={onNavigate}
          aria-label={t("bell.settings")}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-meta transition-colors hover:text-oxblood-deep"
        >
          <Settings className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          {t("bell.settings")}
        </Link>
      </div>
    </div>
  );
}
