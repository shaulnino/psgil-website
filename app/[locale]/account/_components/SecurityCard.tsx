"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, Eye, EyeOff, KeyRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { changeOwnPasswordAction, type FormState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function PasswordField({
  id,
  name,
  label,
  autoComplete,
  minLength,
}: {
  id: string;
  name: string;
  label: string;
  autoComplete: string;
  minLength?: number;
}) {
  const t = useTranslations("account.account");
  const [show, setShow] = useState(false);
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          name={name}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          required
          minLength={minLength}
          dir="ltr"
          className="pe-10"
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? t("hidePassword") : t("showPassword")}
          className="absolute end-0 top-0 flex h-full items-center px-3 text-meta transition-colors hover:text-ink"
        >
          {show ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
        </button>
      </div>
    </div>
  );
}

function PasswordChangeForm({ onClose }: { onClose: () => void }) {
  const t = useTranslations("account.account");
  const [state, action, pending] = useActionState<FormState, FormData>(changeOwnPasswordAction, undefined);

  if (state?.ok) {
    return (
      <div className="space-y-4">
        <p className="flex items-center gap-2 text-sm text-ink">
          <CheckCircle2 className="h-4 w-4 text-[color:var(--isl-success)]" aria-hidden />
          {t("passwordChanged")}
        </p>
        <div className="flex justify-end">
          <Button type="button" variant="primary" size="sm" onClick={onClose}>
            {t("close")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      {state?.error && (
        <p role="alert" className="rounded-[2px] border border-[color:var(--isl-danger)] bg-[color:var(--isl-danger)]/10 px-3 py-2 text-sm text-[color:var(--isl-danger)]">
          {state.error}
        </p>
      )}
      <PasswordField id="current" name="current" label={t("currentPassword")} autoComplete="current-password" />
      <PasswordField id="password" name="password" label={t("newPassword")} autoComplete="new-password" minLength={8} />
      <PasswordField id="confirm" name="confirm" label={t("confirmPassword")} autoComplete="new-password" minLength={8} />
      <p className="text-xs text-meta">{t("passwordRequirement")}</p>
      <div className="flex items-center justify-end gap-3">
        <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={pending}>
          {t("cancel")}
        </Button>
        <Button type="submit" variant="primary" size="sm" loading={pending}>
          {t("changePassword")}
        </Button>
      </div>
    </form>
  );
}

/** Compact security card that opens a focused password-change dialog. */
export default function SecurityCard() {
  const t = useTranslations("account.account");
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream p-5 md:p-6">
      <h2 className="font-isl-display text-lg font-bold tracking-[0.02em] text-ink">{t("security")}</h2>
      <p className="mt-1 text-sm text-meta">{t("passwordRequirement")}</p>
      <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={() => setOpen(true)}>
        <KeyRound className="h-3.5 w-3.5" aria-hidden />
        {t("changePassword")}
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)} title={t("changePassword")} closeLabel={t("close")}>
        <PasswordChangeForm onClose={() => setOpen(false)} />
      </Dialog>
    </div>
  );
}
