"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AppRole } from "@/lib/accounts/types";
import { createAccount, type AdminErrorCode } from "../actions";
import { RolesField } from "./RolesField";

/** Create-account dialog: admin provisions a new account with a temp password. */
export function CreateAccountDialog({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useTranslations("admin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roles, setRoles] = useState<AppRole[]>(["driver"]);
  const [error, setError] = useState<AdminErrorCode | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const res = await createAccount({ name, email, password, roles });
      if (res.ok) onDone();
      else setError(res.error);
    });
  };

  return (
    <Dialog open={open} onClose={onClose} title={t("create.title")} closeLabel={t("common.close")}>
      <div className="space-y-4">
        <div>
          <Label htmlFor="create-name">{t("drawer.name")}</Label>
          <Input id="create-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="create-email">{t("drawer.email")}</Label>
          <Input
            id="create-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="create-pw">{t("create.password")}</Label>
          <Input
            id="create-pw"
            type="text"
            value={password}
            minLength={8}
            autoComplete="off"
            onChange={(e) => setPassword(e.target.value)}
          />
          <p className="mt-1.5 text-xs text-meta">{t("create.passwordHint")}</p>
        </div>
        <div>
          <Label>{t("drawer.roles")}</Label>
          <RolesField value={roles} onChange={setRoles} />
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-[2px] border border-[color:var(--isl-danger)] bg-[color:var(--isl-danger)]/10 px-3 py-2 text-sm text-[color:var(--isl-danger)]"
          >
            {t(`errors.${error}`)}
          </p>
        )}

        <div className="flex items-center justify-end gap-3 pt-1">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={pending}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={submit}
            loading={pending}
            disabled={!name || !email || password.length < 8 || roles.length === 0}
          >
            {t("create.submit")}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
