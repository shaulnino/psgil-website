"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { loginAction, type FormState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginForm({ next }: { next?: string }) {
  const t = useTranslations("account.login");
  const [state, action, pending] = useActionState<FormState, FormData>(loginAction, undefined);

  return (
    <form action={action} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
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
      <div>
        <Label htmlFor="password">{t("password")}</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      <label className="flex items-center gap-2 text-sm text-ink-2">
        <input type="checkbox" name="remember_me" className="accent-[color:var(--isl-oxblood)]" />
        {t("remember")}
      </label>
      <Button type="submit" disabled={pending} className="w-full">
        {t("submit")}
      </Button>
    </form>
  );
}
