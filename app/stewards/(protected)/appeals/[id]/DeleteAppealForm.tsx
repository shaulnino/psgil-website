"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import { deleteAppealAction } from "@/app/stewards/actions";

export default function DeleteAppealForm({ appealId }: { appealId: string }) {
  const formRef = useRef<HTMLFormElement | null>(null);
  return (
    <form ref={formRef} action={deleteAppealAction}>
      <input type="hidden" name="appeal_id" value={appealId} />
      <DeleteButton formRef={formRef} />
    </form>
  );
}

function DeleteButton({ formRef }: { formRef: React.RefObject<HTMLFormElement | null> }) {
  const { pending } = useFormStatus();
  const t = useTranslations("stewards");
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (window.confirm(t("appeals.deleteConfirm"))) {
          formRef.current?.requestSubmit();
        }
      }}
      className="inline-flex items-center gap-2 rounded-[2px] border border-status-danger px-3 py-1.5 text-xs uppercase tracking-[0.08em] text-status-danger transition-colors hover:bg-cream focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--isl-oxblood)] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending && (
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-status-danger/30 border-t-status-danger" />
      )}
      {pending ? t("appeals.deleteLoading") : t("appeals.deleteIdle")}
    </button>
  );
}
