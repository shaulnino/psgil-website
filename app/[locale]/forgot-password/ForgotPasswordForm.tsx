"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { requestPasswordResetAction, type ForgotState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPasswordForm() {
  const t = useTranslations("account.forgot");
  const [state, action, pending] = useActionState<ForgotState, FormData>(
    requestPasswordResetAction,
    undefined,
  );

  if (state?.sent) {
    return (
      <p role="status" className="text-[color:var(--isl-success)]">
        {t("sent")}
      </p>
    );
  }

  return (
    <form action={action} className="space-y-4">
      {state?.error && (
        <p
          role="alert"
          className="rounded-[2px] border border-[color:var(--isl-danger)] bg-[color:var(--isl-danger)]/10 px-3 py-2 text-sm text-[color:var(--isl-danger)]"
        >
          {state.error}
        </p>
      )}
      <div>
        <Label htmlFor="email">{t("email")}</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <Button type="submit" disabled={pending} className="w-full">
        {t("submit")}
      </Button>
    </form>
  );
}
