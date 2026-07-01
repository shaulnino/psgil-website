"use client";

import { useState, useCallback } from "react";
import Modal from "@/app/stewards/components/Modal";
import ChangePasswordForm from "@/app/stewards/change-password/ChangePasswordForm";
import { selfChangePasswordAction } from "@/app/stewards/actions";
import { Button } from "@/components/ui/button";

export default function ChangePasswordModal() {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => setOpen(true)}
      >
        Change password
      </Button>

      <Modal open={open} onClose={close}>
        <div className="w-full max-w-sm rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[color:var(--isl-hairline)] px-6 py-4">
            <div>
              <p className="font-isl-body text-[0.75rem] font-semibold uppercase tracking-[0.2em] text-brass-ink">Account</p>
              <p className="mt-0.5 text-sm font-semibold text-ink">Change Password</p>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="flex h-11 w-11 items-center justify-center rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper text-lg leading-none text-ink-2 transition-colors hover:border-ink hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--isl-oxblood)]"
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
