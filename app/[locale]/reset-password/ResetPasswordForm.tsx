"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { resetPasswordAction, type FormState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ResetPasswordForm({ token }: { token: string }) {
  const t = useTranslations("account.reset");
  const [state, action, pending] = useActionState<FormState, FormData>(resetPasswordAction, undefined);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      {state?.error && (
        <p
          role="alert"
          className="rounded-[2px] border border-[color:var(--isl-danger)] bg-[color:var(--isl-danger)]/10 px-3 py-2 text-sm text-[color:var(--isl-danger)]"
        >
          {state.error}
        </p>
      )}
      <div>
        <Label htmlFor="password">{t("password")}</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
      </div>
      <div>
        <Label htmlFor="confirm">{t("confirm")}</Label>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={8} />
      </div>
      <Button type="submit" disabled={pending} className="w-full">
        {t("submit")}
      </Button>
    </form>
  );
}
