"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { updateProfileAction, type FormState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ProfileForm({ name, email }: { name: string; email: string }) {
  const t = useTranslations("account.account");
  const [state, action, pending] = useActionState<FormState, FormData>(updateProfileAction, undefined);

  return (
    <form action={action} className="space-y-4">
      {state?.error && (
        <p role="alert" className="text-sm text-[color:var(--isl-danger)]">
          {state.error}
        </p>
      )}
      <div>
        <Label htmlFor="name">{t("name")}</Label>
        <Input id="name" name="name" defaultValue={name} autoComplete="name" required />
      </div>
      <div>
        <Label htmlFor="email">{t("email")}</Label>
        <Input id="email" value={email} disabled readOnly />
      </div>
      <Button type="submit" variant="secondary" disabled={pending}>
        {t("save")}
      </Button>
    </form>
  );
}
