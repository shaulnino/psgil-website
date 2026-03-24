"use client";

import { useState } from "react";

export default function ForgotPasswordTip() {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-sm text-white/40 transition hover:text-white/70"
      >
        Forgot your password?
      </button>

      {open && (
        <div className="mt-3 rounded-xl border border-steward-gold/20 bg-steward-gold/6 px-4 py-3 text-left text-sm text-white/70 leading-relaxed">
          <p className="font-semibold text-white/90 mb-1">Contact your league admin</p>
          <p>
            Passwords are managed by league administration. Ask your admin to reset your password — you&apos;ll then be prompted to set a new one on your next login.
          </p>
        </div>
      )}
    </div>
  );
}
