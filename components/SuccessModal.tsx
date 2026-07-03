"use client";

import { useEffect, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import confetti from "canvas-confetti";
import { buttonVariants } from "@/components/ui/button";

type FormMode = "signup" | "question";

interface SuccessModalProps {
  mode: FormMode;
  open: boolean;
  onClose: () => void;
}

export default function SuccessModal({ mode, open, onClose }: SuccessModalProps) {
  const t = useTranslations("forms");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const fireConfetti = useCallback(() => {
    const duration = 1800;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 },
        colors: ["#6b1f28", "#8a6a3b", "#f4efe6", "#1a1a1a"],
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 },
        colors: ["#6b1f28", "#8a6a3b", "#f4efe6", "#1a1a1a"],
      });
      if (Date.now() < end) requestAnimationFrame(frame);
    };

    frame();
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      if (!dialog.open) dialog.showModal();
      btnRef.current?.focus();
      if (mode === "signup") fireConfetti();
    } else {
      if (dialog.open) dialog.close();
    }
  }, [open, mode, fireConfetti]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClose = () => onClose();
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [onClose]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) onClose();
  };

  const hasNote = t.has(`success.${mode}.note`);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="success-modal-title"
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 m-auto max-w-md rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper p-0 text-ink backdrop:bg-black/70 open:animate-[f1-rise_0.5s_ease-out]"
    >
      <div className="flex flex-col items-center gap-4 px-6 py-8 text-center sm:px-8 sm:py-10">
        <h2
          id="success-modal-title"
          className="font-display font-bold tracking-[0.005em] leading-[1.05] text-xl text-ink sm:text-2xl"
        >
          {t(`success.${mode}.title`)}
        </h2>

        <p className="max-w-xs text-sm leading-relaxed text-ink-2">
          {t(`success.${mode}.body`)}
        </p>

        {hasNote && (
          <p className="max-w-xs text-xs leading-relaxed text-meta">
            {t(`success.${mode}.note`)}
          </p>
        )}

        <button
          ref={btnRef}
          type="button"
          onClick={onClose}
          className={`${buttonVariants({ variant: "primary", size: "md" })} mt-2`}
        >
          {t(`success.${mode}.button`)}
        </button>
      </div>
    </dialog>
  );
}
