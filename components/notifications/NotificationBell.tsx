"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Bell } from "lucide-react";
import { Drawer } from "@/components/ui/drawer";
import type { UserNotification } from "@/lib/notifications/types";
import NotificationPanel from "@/components/notifications/NotificationPanel";

const POLL_MS = 60_000;
const PANEL_LIMIT = 12;

type ListResponse = { items: UserNotification[]; total: number; unread: number };

export default function NotificationBell() {
  const t = useTranslations("notifications");
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<UserNotification[]>([]);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"popover" | "drawer">("popover");
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  const refreshSummary = useCallback(() => {
    fetch("/api/notifications/summary")
      .then((r) => r.json())
      .then((s: { unread: number }) => setUnread(s.unread ?? 0))
      .catch(() => {});
  }, []);

  // Poll the badge on mount, on navigation, on focus, and on an interval.
  useEffect(() => {
    refreshSummary();
  }, [pathname, refreshSummary]);

  useEffect(() => {
    const onFocus = () => refreshSummary();
    window.addEventListener("focus", onFocus);
    const id = window.setInterval(refreshSummary, POLL_MS);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.clearInterval(id);
    };
  }, [refreshSummary]);

  // Close the popover on navigation and outside click (drawer handles its own).
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (mode !== "popover") return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [mode]);

  const loadList = useCallback(() => {
    setLoading(true);
    fetch(`/api/notifications/list?limit=${PANEL_LIMIT}`)
      .then((r) => r.json())
      .then((data: ListResponse) => {
        setItems(data.items ?? []);
        setUnread(data.unread ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    // Acknowledge the badge (records seen; does not mark read).
    fetch("/api/notifications/seen", { method: "POST" }).catch(() => {});
  }, []);

  const toggleOpen = () => {
    if (open) {
      setOpen(false);
      return;
    }
    setMode(window.matchMedia("(min-width: 640px)").matches ? "popover" : "drawer");
    setOpen(true);
    loadList();
  };

  const handleMarkAllRead = () => {
    fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    })
      .then((r) => r.json())
      .then(() => {
        setItems((prev) => prev.map((n) => (n.readAt ? n : { ...n, readAt: new Date().toISOString() })));
        setUnread(0);
      })
      .catch(() => {});
  };

  const label = unread > 0 ? t("bell.ariaLabelUnread", { count: unread }) : t("bell.ariaLabel");
  const badge = unread > 99 ? "99+" : String(unread);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={toggleOpen}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="relative flex h-11 w-11 items-center justify-center rounded-[2px] border border-[color:var(--isl-hairline)] text-ink-2 transition-colors hover:border-ink hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--isl-oxblood)]"
      >
        <Bell className="h-5 w-5" strokeWidth={2} aria-hidden />
        {unread > 0 && (
          <span
            className="num absolute -end-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-oxblood px-1 text-[10px] font-bold leading-none text-white"
            aria-hidden
          >
            {badge}
          </span>
        )}
      </button>

      {open && mode === "popover" && (
        <div className="absolute end-0 top-full z-50 mt-2 flex max-h-[70vh] w-80 flex-col overflow-hidden rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper shadow-xl md:w-96">
          <NotificationPanel
            items={items}
            unread={unread}
            loading={loading}
            onMarkAllRead={handleMarkAllRead}
            onNavigate={() => setOpen(false)}
          />
        </div>
      )}

      {mode === "drawer" && (
        <Drawer
          open={open}
          onClose={() => setOpen(false)}
          title={t("bell.title")}
          closeLabel={t("bell.close")}
        >
          <div className="-mx-5 -my-5 h-full">
            <NotificationPanel
              items={items}
              unread={unread}
              loading={loading}
              hideTitle
              onMarkAllRead={handleMarkAllRead}
              onNavigate={() => setOpen(false)}
            />
          </div>
        </Drawer>
      )}
    </div>
  );
}
