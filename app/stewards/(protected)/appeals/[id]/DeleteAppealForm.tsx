"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";
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
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (window.confirm("Delete this appeal? This cannot be undone.")) {
          formRef.current?.requestSubmit();
        }
      }}
      className="inline-flex items-center gap-2 rounded-full border border-red-500/50 px-3 py-1.5 text-xs text-red-200 transition hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending && (
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-red-200/30 border-t-red-100" />
      )}
      {pending ? "Deleting…" : "Delete Appeal"}
    </button>
  );
}
