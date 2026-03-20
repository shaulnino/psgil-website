"use client";

import { useFormStatus } from "react-dom";

type Props = {
  idleLabel: string;
  loadingLabel: string;
  className?: string;
  spinnerClassName?: string;
};

export default function FormActionButton({
  idleLabel,
  loadingLabel,
  className = "",
  spinnerClassName = "border-white/30 border-t-white",
}: Props) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-70 ${className}`}
    >
      {pending && (
        <span className={`inline-block h-4 w-4 animate-spin rounded-full border-2 ${spinnerClassName}`} />
      )}
      {pending ? loadingLabel : idleLabel}
    </button>
  );
}
