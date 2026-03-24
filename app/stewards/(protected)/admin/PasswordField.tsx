"use client";

import { useState } from "react";

export default function PasswordField() {
  const [show, setShow] = useState(false);

  return (
    <div>
      <span className="mb-1 block text-sm text-white/80">Password</span>
      <div className="relative">
        <input
          name="password"
          type={show ? "text" : "password"}
          required
          className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 pr-16 text-sm text-white/90 focus:border-steward-gold/50 focus:outline-none transition"
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-steward-gold/70 hover:text-steward-gold transition"
        >
          {show ? "HIDE" : "SHOW"}
        </button>
      </div>
      {show && (
        <p className="mt-1 text-[10px] text-amber-400/70">
          ⚠ Password is visible — share it securely with the user
        </p>
      )}
    </div>
  );
}
