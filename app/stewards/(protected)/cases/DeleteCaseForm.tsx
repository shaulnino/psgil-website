"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { removeCaseAction } from "@/app/stewards/actions";

export default function DeleteCaseForm({
  caseId,
  redirectTo,
  idleLabel = "Remove",
  loadingLabel = "Removing...",
  className = "",
}: {
  caseId: string;
  redirectTo: string;
  idleLabel?: string;
  loadingLabel?: string;
  className?: string;
}) {
  const formRef = useRef<HTMLFormElement | null>(null);
  return (
    <form ref={formRef} action={removeCaseAction}>
      <input type="hidden" name="case_id" value={caseId} />
      <input type="hidden" name="redirect_to" value={redirectTo} />
      <DeleteButton formRef={formRef} idleLabel={idleLabel} loadingLabel={loadingLabel} className={className} />
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
  const { pending } = useFormStatus();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        const ok = window.confirm(
          "Are you sure you want to delete this case? This will remove case, responses, internal comments, and verdict data.",
        );
        if (ok) formRef.current?.requestSubmit();
      }}
      className={`inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-70 ${className}`}
    >
      {pending && <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-red-200/30 border-t-red-100" />}
      {pending ? loadingLabel : idleLabel}
    </button>
  );
}
