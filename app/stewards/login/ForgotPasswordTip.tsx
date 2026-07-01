"use client";

import { useState } from "react";

export default function ForgotPasswordTip() {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-sm text-meta transition hover:text-oxblood"
      >
        Forgot your password?
      </button>

      {open && (
        <div className="mt-3 rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream px-4 py-3 text-start text-sm text-ink-2 leading-relaxed">
          <p className="font-semibold text-ink mb-1">Contact your league admin</p>
          <p>
            Passwords are managed by league administration. Ask your admin to reset your password — you&apos;ll then be prompted to set a new one on your next login.
          </p>
        </div>
      )}
    </div>
  );
}
