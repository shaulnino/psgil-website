"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { editUserAction } from "@/app/stewards/actions";
import Modal from "@/app/stewards/components/Modal";

type Props = {
  user: { id: string; name: string; email: string; mustChangePassword: boolean };
};

export default function EditUserPanel({ user }: Props) {
  const [open, setOpen] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const inputCls =
    "w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white/90 focus:border-[#D4AF37]/50 focus:outline-none transition";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-full border border-[#D4AF37]/40 bg-[#D4AF37]/10 px-3 py-1 text-xs font-semibold text-[#f4d98a] transition hover:border-[#D4AF37]/70 hover:bg-[#D4AF37]/20"
      >
        Edit
      </button>

      <Modal open={open} onClose={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-2xl border border-[#D4AF37]/30 bg-[#13131f] shadow-[0_24px_60px_rgba(0,0,0,0.6)] flex flex-col">
            {/* header */}
            <div className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#D4AF37]/70">Edit User</p>
                <div className="mt-0.5 flex items-center gap-2">
                  <p className="text-sm font-semibold text-white/90">{user.name}</p>
                  {user.mustChangePassword && (
                    <span className="rounded-full bg-amber-500/15 border border-amber-500/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                      Must change password
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-white/40 hover:text-white transition text-lg leading-none"
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
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/60">Name</span>
                <input name="name" required defaultValue={user.name} className={inputCls} />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/60">Email</span>
                <input name="email" type="email" required defaultValue={user.email} className={inputCls} />
              </label>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-white/60">
                    Reset password
                  </span>
                  <span className="text-[10px] text-white/35">(leave blank to keep current)</span>
                </div>
                <p className="mb-2 text-[11px] text-amber-300/70">
                  Setting a new password will force the user to change it on next login.
                </p>
                <div className="relative">
                  <input
                    name="password"
                    type={showPw ? "text" : "password"}
                    placeholder="Enter new password…"
                    className={`${inputCls} pr-16`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-[#D4AF37]/70 hover:text-[#D4AF37] transition"
                  >
                    {showPw ? "HIDE" : "SHOW"}
                  </button>
                </div>
                {showPw && (
                  <p className="mt-1.5 text-[10px] text-amber-400/70">
                    ⚠ Password is visible — share it securely with the user
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3 pt-2">
                <SaveButton />
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-full border border-white/15 px-5 py-2 text-sm text-white/60 transition hover:border-white/30 hover:text-white"
                >
                  Cancel
                </button>
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
    <button
      type="submit"
      disabled={pending}
      className="rounded-full bg-[#7020B0] px-5 py-2 text-sm font-semibold shadow-[0_0_14px_rgba(112,32,176,0.3)] transition hover:bg-[#7c2ac3] disabled:opacity-60"
    >
      {pending ? "Saving…" : "Save Changes"}
    </button>
  );
}
