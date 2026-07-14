"use client";

import { useState, useTransition } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetPassword, type AdminErrorCode } from "../actions";
import type { AdminAccount } from "./types";

/** Focused password-reset dialog: admin types a temporary password (min 8). */
export function ResetPasswordDialog({
  account,
  onClose,
  onDone,
}: {
  account: AdminAccount | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useTranslations("admin");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<AdminErrorCode | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    if (!account) return;
    setError(null);
    startTransition(async () => {
      const res = await resetPassword(account.id, password);
      if (res.ok) onDone();
      else setError(res.error);
    });
  };

  return (
    <Dialog
      open={!!account}
      onClose={onClose}
      title={t("reset.title")}
      closeLabel={t("common.close")}
    >
      <div className="space-y-4">
        <p className="text-sm text-ink-2">
          {t("reset.for", { name: account?.name ?? "", email: account?.email ?? "" })}
        </p>
        <div>
          <Label htmlFor="reset-pw">{t("reset.field")}</Label>
          <div className="relative">
            <Input
              id="reset-pw"
              type={show ? "text" : "password"}
              value={password}
              minLength={8}
              autoComplete="new-password"
              onChange={(e) => setPassword(e.target.value)}
              className="pe-10"
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              aria-label={show ? t("reset.hide") : t("reset.show")}
              className="absolute end-0 top-0 flex h-full items-center px-3 text-meta transition-colors hover:text-ink"
            >
              {show ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
            </button>
          </div>
          <p className="mt-1.5 text-xs text-meta">{t("reset.hint")}</p>
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
            disabled={password.length < 8}
          >
            {t("reset.confirm")}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
