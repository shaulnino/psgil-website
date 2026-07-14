"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, CheckCircle2, Search, UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Menu, type MenuItem } from "@/components/ui/menu";
import { type AppRole } from "@/lib/accounts/types";
import { removeAccount, setActive } from "../actions";
import { EditAccountDrawer } from "./EditAccountDrawer";
import { ResetPasswordDialog } from "./ResetPasswordDialog";
import { CreateAccountDialog } from "./CreateAccountDialog";
import { ConfirmDialog } from "./ConfirmDialog";
import type { AdminAccount, DriverOption } from "./types";

const PRIVILEGED: AppRole[] = ["admin", "steward"];

type ConfirmState = { kind: "suspend" | "reactivate" | "remove"; account: AdminAccount } | null;

export function AccountsAdmin({
  accounts,
  drivers,
  currentUserId,
}: {
  accounts: AdminAccount[];
  drivers: DriverOption[];
  currentUserId: string;
}) {
  const t = useTranslations("admin");
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [editAccount, setEditAccount] = useState<AdminAccount | null>(null);
  const [resetTarget, setResetTarget] = useState<AdminAccount | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const driverName = useMemo(() => {
    const map = new Map(drivers.map((d) => [d.id, d]));
    return (id: string | null) => (id ? (map.get(id) ?? null) : null);
  }, [drivers]);

  const activeAdminCount = useMemo(
    () => accounts.filter((a) => a.isActive && a.roles.includes("admin")).length,
    [accounts],
  );
  const isLastActiveAdmin = (a: AdminAccount) =>
    a.isActive && a.roles.includes("admin") && activeAdminCount <= 1;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter(
      (a) => a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q),
    );
  }, [accounts, query]);

  const done = (msg: string) => {
    setNotice(msg);
    router.refresh();
  };

  const adminRemovalReason = (a: AdminAccount) =>
    a.id === currentUserId
      ? t("errors.own-admin")
      : isLastActiveAdmin(a)
        ? t("errors.last-admin")
        : undefined;

  const buildMenu = (a: AdminAccount): MenuItem[] => {
    const selfBlock = a.id === currentUserId;
    const items: MenuItem[] = [
      { key: "edit", label: t("menu.edit"), onSelect: () => setEditAccount(a) },
      { key: "reset", label: t("menu.reset"), onSelect: () => setResetTarget(a) },
    ];
    if (a.isActive) {
      const blocked = selfBlock
        ? t("errors.cannot-suspend-self")
        : isLastActiveAdmin(a)
          ? t("errors.last-admin")
          : undefined;
      items.push({
        key: "suspend",
        label: t("menu.suspend"),
        onSelect: () => setConfirm({ kind: "suspend", account: a }),
        disabled: !!blocked,
        title: blocked,
      });
    } else {
      items.push({
        key: "reactivate",
        label: t("menu.reactivate"),
        onSelect: () => setConfirm({ kind: "reactivate", account: a }),
      });
    }
    const removeBlocked = selfBlock
      ? t("errors.cannot-remove-self")
      : isLastActiveAdmin(a)
        ? t("errors.last-admin")
        : undefined;
    items.push({
      key: "remove",
      label: t("menu.remove"),
      tone: "danger",
      onSelect: () => setConfirm({ kind: "remove", account: a }),
      disabled: !!removeBlocked,
      title: removeBlocked,
    });
    return items;
  };

  const roleBadges = (a: AdminAccount) => (
    <div className="flex flex-wrap gap-1">
      {a.roles.map((r) => (
        <Badge key={r} variant={PRIVILEGED.includes(r) ? "brass" : "ink"} className="normal-case tracking-normal">
          {t(`roles.${r}`)}
        </Badge>
      ))}
    </div>
  );

  const driverCell = (a: AdminAccount) => {
    const linked = driverName(a.driverId);
    const hasDriverRole = a.roles.includes("driver");
    if (a.driverId && !linked) {
      return <span className="text-sm text-[color:var(--isl-warning)]">{t("driverLink.missing")}</span>;
    }
    if (!a.driverId) {
      return (
        <span className="text-sm text-faint">
          {t("driverLink.none")}
          {hasDriverRole && (
            <span className="ms-1.5 text-[color:var(--isl-warning)]">· {t("driverLink.roleNoLinkShort")}</span>
          )}
        </span>
      );
    }
    return (
      <span className="text-sm text-ink">
        {linked?.name}
        {!hasDriverRole && (
          <span className="ms-1.5 text-[color:var(--isl-warning)]">· {t("driverLink.linkNoRoleShort")}</span>
        )}
      </span>
    );
  };

  const statusBadge = (a: AdminAccount) =>
    a.isActive ? (
      <StatusBadge icon={CheckCircle2} tone="success">
        {t("status.active")}
      </StatusBadge>
    ) : (
      <StatusBadge icon={Ban} tone="danger">
        {t("status.suspended")}
      </StatusBadge>
    );

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search
            className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-meta"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchPlaceholder")}
            className="w-full rounded-[2px] border border-[color:var(--isl-hairline-strong)] bg-sink py-2.5 ps-9 pe-3 text-sm text-ink placeholder:text-faint focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--isl-oxblood)]"
          />
        </div>
        <Button variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
          <UserPlus className="h-4 w-4" aria-hidden />
          {t("create.button")}
        </Button>
      </div>

      {notice && (
        <p className="rounded-[2px] border border-[color:var(--isl-success)] bg-[color:var(--isl-success)]/10 px-3 py-2 text-sm text-ink">
          {notice}
        </p>
      )}

      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream md:block">
        <table className="min-w-full text-start text-sm">
          <thead>
            <tr className="border-b border-[color:var(--isl-hairline)] bg-sink text-meta">
              <th className="px-4 py-2.5 text-start font-isl-body text-xs font-semibold uppercase tracking-[0.12em]">{t("cols.account")}</th>
              <th className="px-4 py-2.5 text-start font-isl-body text-xs font-semibold uppercase tracking-[0.12em]">{t("cols.roles")}</th>
              <th className="px-4 py-2.5 text-start font-isl-body text-xs font-semibold uppercase tracking-[0.12em]">{t("cols.driver")}</th>
              <th className="px-4 py-2.5 text-start font-isl-body text-xs font-semibold uppercase tracking-[0.12em]">{t("cols.status")}</th>
              <th className="px-4 py-2.5 text-end font-isl-body text-xs font-semibold uppercase tracking-[0.12em]">{t("cols.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => (
              <tr key={a.id} className="border-t border-[color:var(--isl-hairline)] align-middle">
                <td className="px-4 py-3">
                  <div className="font-isl-body font-semibold text-ink">
                    {a.name}
                    {a.id === currentUserId && (
                      <span className="ms-2 text-[0.65rem] uppercase tracking-[0.1em] text-oxblood">{t("you")}</span>
                    )}
                  </div>
                  <div className="text-xs text-meta">{a.email}</div>
                </td>
                <td className="px-4 py-3">{roleBadges(a)}</td>
                <td className="px-4 py-3">{driverCell(a)}</td>
                <td className="px-4 py-3">{statusBadge(a)}</td>
                <td className="px-4 py-3 text-end">
                  <Menu items={buildMenu(a)} label={t("menu.label", { name: a.name })} />
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-faint">
                  {query ? t("noMatches") : t("empty")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {filtered.map((a) => (
          <div key={a.id} className="rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate font-isl-body font-semibold text-ink">
                  {a.name}
                  {a.id === currentUserId && (
                    <span className="ms-2 text-[0.65rem] uppercase tracking-[0.1em] text-oxblood">{t("you")}</span>
                  )}
                </div>
                <div className="truncate text-xs text-meta">{a.email}</div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {statusBadge(a)}
                <Menu items={buildMenu(a)} label={t("menu.label", { name: a.name })} />
              </div>
            </div>
            <div className="mt-3">{roleBadges(a)}</div>
            <div className="mt-2">{driverCell(a)}</div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="rounded-[2px] border border-dashed border-[color:var(--isl-hairline)] px-4 py-8 text-center text-sm text-faint">
            {query ? t("noMatches") : t("empty")}
          </p>
        )}
      </div>

      {/* Edit drawer */}
      <EditAccountDrawer
        key={`edit-${editAccount?.id ?? "none"}`}
        account={editAccount}
        drivers={drivers}
        adminRemovalBlockedReason={editAccount ? adminRemovalReason(editAccount) : undefined}
        onClose={() => setEditAccount(null)}
        onSaved={() => {
          setEditAccount(null);
          done(t("success.saved"));
        }}
      />

      {/* Reset password */}
      <ResetPasswordDialog
        key={`reset-${resetTarget?.id ?? "none"}`}
        account={resetTarget}
        onClose={() => setResetTarget(null)}
        onDone={() => {
          setResetTarget(null);
          done(t("success.reset"));
        }}
      />

      {/* Create */}
      <CreateAccountDialog
        key={createOpen ? "create-open" : "create-closed"}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onDone={() => {
          setCreateOpen(false);
          done(t("success.created"));
        }}
      />

      {/* Suspend / Reactivate / Remove */}
      {confirm && confirm.kind === "remove" && (
        <ConfirmDialog
          key={`remove-${confirm.account.id}`}
          open
          title={t("remove.title")}
          confirmLabel={t("remove.confirm")}
          tone="danger"
          onConfirm={() => removeAccount(confirm.account.id)}
          onClose={() => setConfirm(null)}
          onDone={() => {
            setConfirm(null);
            done(t("success.removed"));
          }}
        >
          <p className="mb-2">{t("remove.body", { name: confirm.account.name, email: confirm.account.email })}</p>
          <ul className="list-disc space-y-1 ps-5 text-xs text-meta">
            <li>{t("remove.permanent")}</li>
            <li>{t("remove.driverKept")}</li>
            <li>{t("remove.historyKept")}</li>
            <li>{t("remove.caseRefs")}</li>
          </ul>
          <p className="mt-2 text-xs text-ink-2">{t("remove.tip")}</p>
        </ConfirmDialog>
      )}
      {confirm && confirm.kind === "suspend" && (
        <ConfirmDialog
          key={`suspend-${confirm.account.id}`}
          open
          title={t("suspend.title")}
          confirmLabel={t("suspend.confirm")}
          tone="danger"
          onConfirm={() => setActive(confirm.account.id, false)}
          onClose={() => setConfirm(null)}
          onDone={() => {
            setConfirm(null);
            done(t("success.suspended"));
          }}
        >
          {t("suspend.body", { name: confirm.account.name })}
        </ConfirmDialog>
      )}
      {confirm && confirm.kind === "reactivate" && (
        <ConfirmDialog
          key={`reactivate-${confirm.account.id}`}
          open
          title={t("reactivate.title")}
          confirmLabel={t("reactivate.confirm")}
          onConfirm={() => setActive(confirm.account.id, true)}
          onClose={() => setConfirm(null)}
          onDone={() => {
            setConfirm(null);
            done(t("success.reactivated"));
          }}
        >
          {t("reactivate.body", { name: confirm.account.name })}
        </ConfirmDialog>
      )}
    </div>
  );
}
