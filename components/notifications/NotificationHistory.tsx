"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCheck } from "lucide-react";
import type { UserNotification } from "@/lib/notifications/types";
import NotificationItem from "@/components/notifications/NotificationItem";

const PAGE = 20;

type ListResponse = { items: UserNotification[]; total: number; unread: number };

/** Full notification history with "load more" pagination (the /notifications page). */
export default function NotificationHistory() {
  const t = useTranslations("notifications");
  const [items, setItems] = useState<UserNotification[]>([]);
  const [total, setTotal] = useState(0);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchPage = useCallback((offset: number) => {
    return fetch(`/api/notifications/list?limit=${PAGE}&offset=${offset}`)
      .then((r) => r.json() as Promise<ListResponse>)
      .catch(() => ({ items: [], total: 0, unread: 0 }) as ListResponse);
  }, []);

  useEffect(() => {
    fetchPage(0)
      .then((data) => {
        setItems(data.items);
        setTotal(data.total);
        setUnread(data.unread);
      })
      .finally(() => setLoading(false));
    // Opening the page acknowledges the badge.
    fetch("/api/notifications/seen", { method: "POST" }).catch(() => {});
  }, [fetchPage]);

  const loadMore = () => {
    setLoadingMore(true);
    fetchPage(items.length)
      .then((data) => setItems((prev) => [...prev, ...data.items]))
      .finally(() => setLoadingMore(false));
  };

  const markAllRead = () => {
    fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    })
      .then(() => {
        setItems((prev) => prev.map((n) => (n.readAt ? n : { ...n, readAt: new Date().toISOString() })));
        setUnread(0);
      })
      .catch(() => {});
  };

  if (loading) {
    return <p className="py-10 text-center text-sm text-meta">{t("bell.loading")}</p>;
  }

  if (items.length === 0) {
    return (
      <div className="rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream px-6 py-12 text-center">
        <p className="text-sm font-medium text-ink">{t("page.empty")}</p>
        <p className="mt-1 text-xs text-meta">{t("page.emptyHint")}</p>
      </div>
    );
  }

  return (
    <div>
      {unread > 0 && (
        <div className="mb-3 flex justify-end">
          <button
            type="button"
            onClick={markAllRead}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-meta transition-colors hover:text-oxblood-deep"
          >
            <CheckCheck className="h-4 w-4" strokeWidth={2} aria-hidden />
            {t("bell.markAllRead")}
          </button>
        </div>
      )}
      <ul className="divide-y divide-[color:var(--isl-hairline)] overflow-hidden rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper">
        {items.map((n) => (
          <li key={n.id}>
            <NotificationItem n={n} />
          </li>
        ))}
      </ul>
      {items.length < total && (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-ink disabled:opacity-60"
          >
            {loadingMore ? t("bell.loading") : t("page.loadMore")}
          </button>
        </div>
      )}
    </div>
  );
}
