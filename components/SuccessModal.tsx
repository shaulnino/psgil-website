"use client";

import { useEffect, useRef, useCallback } from "react";
import confetti from "canvas-confetti";

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
        colors: ["#7020B0", "#D4AF37", "#ffffff", "#a855f7"],
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 },
        colors: ["#7020B0", "#D4AF37", "#ffffff", "#a855f7"],
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
      className="fixed inset-0 z-50 m-auto max-w-md rounded-2xl border border-white/10 bg-[#0e0e12] p-0 text-white shadow-[0_0_60px_rgba(112,32,176,0.25)] backdrop:bg-black/60 backdrop:backdrop-blur-sm open:animate-[modal-pop_0.25s_ease-out]"
    >
      <div className="flex flex-col items-center gap-4 px-6 py-8 text-center sm:px-8 sm:py-10">
        <h2
          id="success-modal-title"
          className="text-xl font-bold tracking-tight sm:text-2xl"
        >
          {copy.title}
        </h2>

        <p className="max-w-xs text-sm leading-relaxed text-white/70">
          {copy.body}
        </p>

        {copy.note && (
          <p className="max-w-xs text-xs leading-relaxed text-white/40">
            {copy.note}
          </p>
        )}

        <button
          ref={btnRef}
          type="button"
          onClick={onClose}
          className="mt-2 inline-flex items-center justify-center rounded-full bg-[#7020B0] px-8 py-2.5 text-sm font-semibold text-white shadow-[0_0_20px_rgba(112,32,176,0.35)] transition hover:-translate-y-0.5 hover:shadow-[0_0_28px_rgba(112,32,176,0.6)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7020B0]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0e0e12]"
        >
          {copy.button}
        </button>
      </div>
    </dialog>
  );
}
