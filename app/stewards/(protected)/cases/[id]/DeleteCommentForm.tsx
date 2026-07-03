"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("stewards");
  const { pending } = useFormStatus();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (window.confirm(t("cases.comment.deleteConfirm"))) formRef.current?.requestSubmit();
      }}
      className="rounded-[2px] px-1.5 py-0.5 text-[10px] text-meta transition hover:bg-cream hover:text-status-danger disabled:opacity-50"
    >
      {pending ? "…" : t("cases.comment.delete")}
    </button>
  );
}
