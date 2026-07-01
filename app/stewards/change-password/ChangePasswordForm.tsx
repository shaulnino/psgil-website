"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

const MIN_LENGTH = 8;

const inputCls =
  "w-full rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper px-3 py-2.5 text-sm text-ink placeholder:text-faint focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--isl-oxblood)] transition-colors";

function ShowHideInput({
  name,
  label,
  placeholder,
}: {
  name: string;
  label: string;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-meta">{label}</span>
      <div className="relative">
        <input
          name={name}
          required
          type={show ? "text" : "password"}
          placeholder={placeholder}
          minLength={MIN_LENGTH}
          className={`${inputCls} pe-16`}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShow((v) => !v)}
          className="absolute end-3 top-1/2 -translate-y-1/2 text-[10px] font-bold tracking-widest text-brass-ink hover:text-ink transition-colors"
        >
          {show ? "HIDE" : "SHOW"}
        </button>
      </div>
    </label>
  );
}

function SubmitBtn({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" disabled={pending} className="w-full">
      {pending ? "Saving…" : label}
    </Button>
  );
}

type Props = {
  action: (fd: FormData) => Promise<void> | Promise<{ error?: string }>;
  requireCurrent: boolean;
  onSuccess?: () => void;
  submitLabel?: string;
};

export default function ChangePasswordForm({
  action,
  requireCurrent,
  onSuccess,
  submitLabel = "Set new password",
}: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleAction = async (fd: FormData) => {
    setClientError(null);
    const newPw = fd.get("new_password") as string;
    const confirm = fd.get("confirm_password") as string;

    if (newPw.length < MIN_LENGTH) {
      setClientError(`Password must be at least ${MIN_LENGTH} characters.`);
      return;
    }
    if (newPw !== confirm) {
      setClientError("Passwords do not match.");
      return;
    }

    const result = await action(fd);
    // action may redirect (forced flow) or return { error } (voluntary flow)
    if (result && typeof result === "object" && "error" in result && result.error) {
      const e = result.error as string;
      setClientError(
        e === "current-incorrect" ? "Current password is incorrect." :
        e === "too-short"         ? `Password must be at least ${MIN_LENGTH} characters.` :
        e === "mismatch"          ? "Passwords do not match." :
                                    "Something went wrong. Please try again.",
      );
    } else if (!result || (typeof result === "object" && !("error" in result))) {
      setSuccess(true);
      formRef.current?.reset();
      onSuccess?.();
    }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <span className="text-3xl text-status-success">✓</span>
        <p className="font-semibold text-ink">Password updated successfully.</p>
        <button
          type="button"
          onClick={() => setSuccess(false)}
          className="text-xs text-meta hover:text-ink transition-colors"
        >
          Change again
        </button>
      </div>
    );
  }

  return (
    <form ref={formRef} action={handleAction} className="space-y-4">
      {requireCurrent && (
        <ShowHideInput
          name="current_password"
          label="Current password"
          placeholder="Enter current password…"
        />
      )}
      <ShowHideInput
        name="new_password"
        label="New password"
        placeholder="At least 8 characters…"
      />
      <ShowHideInput
        name="confirm_password"
        label="Confirm new password"
        placeholder="Repeat new password…"
      />

      {clientError && (
        <p className="rounded-[2px] border border-status-danger bg-paper px-3 py-2 text-sm text-status-danger">
          {clientError}
        </p>
      )}

      <SubmitBtn label={submitLabel} />
    </form>
  );
}
