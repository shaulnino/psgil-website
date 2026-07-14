"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AppRole } from "@/lib/accounts/types";
import { saveAccount, type AdminErrorCode } from "../actions";
import { RolesField } from "./RolesField";
import { DriverLinkField } from "./DriverLinkField";
import type { AdminAccount, DriverOption } from "./types";

/**
 * Edit-account side drawer. Holds staged edits for one account (name, email,
 * roles, driver link) and commits them with a single "Save changes" (per-user
 * save model). Errors surface inline in the drawer; on success the parent
 * refreshes and the drawer closes.
 */
export function EditAccountDrawer({
  account,
  drivers,
  adminRemovalBlockedReason,
  onClose,
  onSaved,
}: {
  account: AdminAccount | null;
  drivers: DriverOption[];
  /** Localized reason if the `admin` role must not be removed from this account. */
  adminRemovalBlockedReason?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("admin");
  // State is seeded from props at mount; the parent passes a `key` per account
  // so opening a different account remounts this drawer with fresh values.
  const [name, setName] = useState(account?.name ?? "");
  const [email, setEmail] = useState(account?.email ?? "");
  const [roles, setRoles] = useState<AppRole[]>(account?.roles ?? []);
  const [driverId, setDriverId] = useState<string | null>(account?.driverId ?? null);
  const [error, setError] = useState<AdminErrorCode | null>(null);
  const [pending, startTransition] = useTransition();

  const disabledRoles =
    account && adminRemovalBlockedReason && account.roles.includes("admin")
      ? [{ role: "admin" as AppRole, reason: adminRemovalBlockedReason }]
      : [];

  // Driver-link state hints (nothing is auto-changed).
  const hasDriverRole = roles.includes("driver");
  const linkHint = !account
    ? null
    : hasDriverRole && !driverId
      ? t("driverLink.roleNoLink")
      : !hasDriverRole && driverId
        ? t("driverLink.linkNoRole")
        : null;

  const submit = () => {
    if (!account) return;
    setError(null);
    startTransition(async () => {
      const res = await saveAccount({ userId: account.id, name, email, roles, driverId });
      if (res.ok) {
        onSaved();
      } else {
        setError(res.error);
      }
    });
  };

  return (
    <Drawer
      open={!!account}
      onClose={onClose}
      title={t("drawer.title")}
      closeLabel={t("common.close")}
      footer={
        <div className="flex items-center justify-end gap-3">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={pending}>
            {t("common.cancel")}
          </Button>
          <Button variant="primary" size="sm" onClick={submit} loading={pending}>
            {t("drawer.save")}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div>
          <Label htmlFor="edit-name">{t("drawer.name")}</Label>
          <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="edit-email">{t("drawer.email")}</Label>
          <Input
            id="edit-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <Label>{t("drawer.roles")}</Label>
          <RolesField value={roles} onChange={setRoles} disabledRoles={disabledRoles} />
        </div>
        <div>
          <Label>{t("drawer.driver")}</Label>
          <DriverLinkField value={driverId} onChange={setDriverId} drivers={drivers} />
          {linkHint && <p className="mt-1.5 text-xs text-[color:var(--isl-warning)]">{linkHint}</p>}
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-[2px] border border-[color:var(--isl-danger)] bg-[color:var(--isl-danger)]/10 px-3 py-2 text-sm text-[color:var(--isl-danger)]"
          >
            {t(`errors.${error}`)}
          </p>
        )}
      </div>
    </Drawer>
  );
}
