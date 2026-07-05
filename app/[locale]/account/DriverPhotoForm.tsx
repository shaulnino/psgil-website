"use client";

import Image from "next/image";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { uploadDriverPhotoAction, type FormState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";

export default function DriverPhotoForm({ currentPhotoUrl }: { currentPhotoUrl: string | null }) {
  const t = useTranslations("account.account");
  const [state, action, pending] = useActionState<FormState, FormData>(uploadDriverPhotoAction, undefined);

  return (
    <form action={action} className="space-y-4">
      {state?.error && (
        <p role="alert" className="text-sm text-[color:var(--isl-danger)]">
          {state.error}
        </p>
      )}
      <div className="flex items-center gap-4">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-[2px] border border-[color:var(--isl-hairline)] bg-sink">
          {currentPhotoUrl ? (
            <Image src={currentPhotoUrl} alt="" fill sizes="80px" className="object-cover" unoptimized />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-[10px] uppercase tracking-wide text-faint">
              {t("photoNone")}
            </span>
          )}
        </div>
        <div className="text-xs text-meta">{t("photoHint")}</div>
      </div>
      <input
        type="file"
        name="photo"
        accept="image/*"
        required
        className="block w-full text-sm text-ink-2 file:me-3 file:rounded-[2px] file:border file:border-[color:var(--isl-hairline-strong)] file:bg-paper file:px-3 file:py-1.5 file:text-xs file:font-semibold file:uppercase file:tracking-[0.06em] file:text-ink"
      />
      <Button type="submit" variant="secondary" disabled={pending}>
        {t("photoUpload")}
      </Button>
    </form>
  );
}
