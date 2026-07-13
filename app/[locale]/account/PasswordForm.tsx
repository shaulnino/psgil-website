"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { changeOwnPasswordAction, type FormState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function PasswordForm() {
  const t = useTranslations("account.account");
  const [state, action, pending] = useActionState<FormState, FormData>(changeOwnPasswordAction, undefined);

  return (
    <form action={action} className="space-y-4">
      {state?.error && (
        <p role="alert" className="text-sm text-[color:var(--isl-danger)]">
          {state.error}
        </p>
      )}
      <div>
        <Label htmlFor="current">{t("currentPassword")}</Label>
        <Input id="current" name="current" type="password" autoComplete="current-password" required />
      </div>
      <div>
        <Label htmlFor="password">{t("newPassword")}</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
      </div>
      <div>
        <Label htmlFor="confirm">{t("confirmPassword")}</Label>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={8} />
      </div>
      <Button type="submit" variant="secondary" disabled={pending}>
        {t("changePassword")}
      </Button>
    </form>
  );
}
