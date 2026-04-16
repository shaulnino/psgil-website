"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { deleteInternalCommentAction } from "@/app/stewards/actions";

export default function DeleteCommentForm({
  commentId,
  caseId,
}: {
  commentId: string;
  caseId: string;
}) {
  const formRef = useRef<HTMLFormElement | null>(null);
  return (
    <form ref={formRef} action={deleteInternalCommentAction}>
      <input type="hidden" name="comment_id" value={commentId} />
      <input type="hidden" name="case_id" value={caseId} />
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
        if (window.confirm("Delete this comment?")) formRef.current?.requestSubmit();
      }}
      className="rounded px-1.5 py-0.5 text-[10px] text-white/40 transition hover:bg-red-500/15 hover:text-red-300 disabled:opacity-50"
    >
      {pending ? "…" : "Delete"}
    </button>
  );
}
