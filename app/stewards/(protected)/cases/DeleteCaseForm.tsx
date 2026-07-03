"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import { removeCaseAction } from "@/app/stewards/actions";

export default function DeleteCaseForm({
  caseId,
  redirectTo,
  idleLabel,
  loadingLabel,
  className = "",
}: {
  caseId: string;
  redirectTo: string;
  idleLabel?: string;
  loadingLabel?: string;
  className?: string;
}) {
  const t = useTranslations("stewards");
  const formRef = useRef<HTMLFormElement | null>(null);
  return (
    <form ref={formRef} action={removeCaseAction}>
      <input type="hidden" name="case_id" value={caseId} />
      <input type="hidden" name="redirect_to" value={redirectTo} />
      <DeleteButton
        formRef={formRef}
        idleLabel={idleLabel ?? t("cases.delete.remove")}
        loadingLabel={loadingLabel ?? t("cases.delete.removing")}
        className={className}
      />
    </form>
  );
}

function DeleteButton({
  formRef,
  idleLabel,
  loadingLabel,
  className,
}: {
  formRef: React.RefObject<HTMLFormElement | null>;
  idleLabel: string;
  loadingLabel: string;
  className: string;
}) {
  const t = useTranslations("stewards");
  const { pending } = useFormStatus();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        const ok = window.confirm(t("cases.delete.confirm"));
        if (ok) formRef.current?.requestSubmit();
      }}
      className={`inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-70 ${className}`}
    >
      {pending && <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[color:var(--isl-hairline)] border-t-status-danger" />}
      {pending ? loadingLabel : idleLabel}
    </button>
  );
}
