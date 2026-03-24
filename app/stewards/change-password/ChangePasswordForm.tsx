"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";

const MIN_LENGTH = 8;

const inputCls =
  "w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2.5 text-sm text-white/90 focus:border-steward-gold/50 focus:outline-none transition placeholder:text-white/25";

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
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/60">{label}</span>
      <div className="relative">
        <input
          name={name}
          required
          type={show ? "text" : "password"}
          placeholder={placeholder}
          minLength={MIN_LENGTH}
          className={`${inputCls} pr-16`}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShow((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold tracking-widest text-steward-gold/60 hover:text-steward-gold transition"
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
    <button
      type="submit"
      disabled={pending}
      className="w-full justify-center rounded-full bg-[#7020B0] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_0_18px_rgba(112,32,176,0.35)] transition hover:bg-[#7d2ac5] disabled:opacity-60"
    >
      {pending ? "Saving…" : label}
    </button>
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
        <span className="text-3xl">✓</span>
        <p className="font-semibold text-white/90">Password updated successfully.</p>
        <button
          type="button"
          onClick={() => setSuccess(false)}
          className="text-xs text-white/40 hover:text-white/70 transition"
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
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {clientError}
        </p>
      )}

      <SubmitBtn label={submitLabel} />
    </form>
  );
}
