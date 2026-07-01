"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { editUserAction } from "@/app/stewards/actions";
import Modal from "@/app/stewards/components/Modal";
import { Button } from "@/components/ui/button";

type Props = {
  user: { id: string; name: string; email: string; mustChangePassword: boolean };
};

export default function EditUserPanel({ user }: Props) {
  const [open, setOpen] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const inputCls =
    "w-full rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper px-3 py-2 text-sm text-ink placeholder:text-faint focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--isl-oxblood)] transition";

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => setOpen((v) => !v)}
      >
        Edit
      </Button>

      <Modal open={open} onClose={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper flex flex-col">
            {/* header */}
            <div className="border-b border-[color:var(--isl-hairline)] px-6 py-4 flex items-center justify-between">
              <div>
                <p className="font-isl-body text-[0.75rem] font-semibold uppercase tracking-[0.2em] text-brass-ink">Edit User</p>
                <div className="mt-0.5 flex items-center gap-2">
                  <p className="text-sm font-semibold text-ink">{user.name}</p>
                  {user.mustChangePassword && (
                    <span className="rounded-[2px] border border-status-warning px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-status-warning">
                      Must change password
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="flex h-11 w-11 items-center justify-center rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper text-lg leading-none text-ink-2 transition-colors hover:border-ink hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--isl-oxblood)]"
              >
                ✕
              </button>
            </div>

            {/* form */}
            <form
              action={async (fd) => {
                await editUserAction(fd);
                setOpen(false);
              }}
              className="px-6 py-5 space-y-4"
            >
              <input type="hidden" name="user_id" value={user.id} />

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-meta">Name</span>
                <input name="name" required defaultValue={user.name} className={inputCls} />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-meta">Email</span>
                <input name="email" type="email" required defaultValue={user.email} className={inputCls} />
              </label>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-meta">
                    Reset password
                  </span>
                  <span className="text-[10px] text-faint">(leave blank to keep current)</span>
                </div>
                <p className="mb-2 text-[11px] text-status-warning">
                  Setting a new password will force the user to change it on next login.
                </p>
                <div className="relative">
                  <input
                    name="password"
                    type={showPw ? "text" : "password"}
                    placeholder="Enter new password…"
                    className={`${inputCls} pe-16`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute end-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-brass-ink transition-colors hover:text-oxblood-deep"
                  >
                    {showPw ? "HIDE" : "SHOW"}
                  </button>
                </div>
                {showPw && (
                  <p className="mt-1.5 text-[10px] text-status-warning">
                    ⚠ Password is visible — share it securely with the user
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3 pt-2">
                <SaveButton />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
      </Modal>
    </>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" disabled={pending}>
      {pending ? "Saving…" : "Save Changes"}
    </Button>
  );
}
