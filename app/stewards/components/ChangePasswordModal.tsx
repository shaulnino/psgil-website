"use client";

import { useState, useCallback } from "react";
import Modal from "@/app/stewards/components/Modal";
import ChangePasswordForm from "@/app/stewards/change-password/ChangePasswordForm";
import { selfChangePasswordAction } from "@/app/stewards/actions";

export default function ChangePasswordModal() {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-medium text-white/60 transition hover:border-white/30 hover:text-white/90"
      >
        Change password
      </button>

      <Modal open={open} onClose={close}>
        <div className="w-full max-w-sm rounded-2xl border border-steward-gold/30 bg-[#13131f] shadow-[0_24px_60px_rgba(0,0,0,0.6)]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-steward-gold/70">Account</p>
              <p className="mt-0.5 text-sm font-semibold text-white/90">Change Password</p>
            </div>
            <button
              type="button"
              onClick={close}
              className="text-lg leading-none text-white/40 transition hover:text-white"
            >
              ✕
            </button>
          </div>

          {/* Form */}
          <div className="px-6 py-5">
            <ChangePasswordForm
              action={selfChangePasswordAction}
              requireCurrent
              onSuccess={close}
              submitLabel="Update password"
            />
          </div>
        </div>
      </Modal>
    </>
  );
}
