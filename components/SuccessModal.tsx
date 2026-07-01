"use client";

import { useEffect, useRef, useCallback } from "react";
import confetti from "canvas-confetti";
import { buttonVariants } from "@/components/ui/button";

type FormMode = "signup" | "question";

interface SuccessModalProps {
  mode: FormMode;
  open: boolean;
  onClose: () => void;
}

const COPY = {
  signup: {
    title: "Welcome to ISL! 🏁",
    body: "You\u2019re officially on the list. We\u2019ll reach out to you by email soon with the next steps and availability.",
    note: "If you don\u2019t see our email, check your spam/promotions folder.",
    button: "Awesome",
  },
  question: {
    title: "Message received \u2705",
    body: "Thanks \u2014 we got your question. We\u2019ll reply to you by email as soon as possible.",
    note: null,
    button: "Got it",
  },
} as const;

export default function SuccessModal({ mode, open, onClose }: SuccessModalProps) {
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

  const copy = COPY[mode];

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="success-modal-title"
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 m-auto max-w-md rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper p-0 text-ink backdrop:bg-[color:var(--isl-ink)]/60 open:animate-[f1-rise_0.5s_ease-out]"
    >
      <div className="flex flex-col items-center gap-4 px-6 py-8 text-center sm:px-8 sm:py-10">
        <h2
          id="success-modal-title"
          className="font-display font-bold tracking-[0.005em] leading-[1.05] text-xl text-ink sm:text-2xl"
        >
          {copy.title}
        </h2>

        <p className="max-w-xs text-sm leading-relaxed text-ink-2">
          {copy.body}
        </p>

        {copy.note && (
          <p className="max-w-xs text-xs leading-relaxed text-meta">
            {copy.note}
          </p>
        )}

        <button
          ref={btnRef}
          type="button"
          onClick={onClose}
          className={`${buttonVariants({ variant: "primary", size: "md" })} mt-2`}
        >
          {copy.button}
        </button>
      </div>
    </dialog>
  );
}
