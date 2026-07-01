"use client";

import { useState } from "react";

export default function PasswordField() {
  const [show, setShow] = useState(false);

  return (
    <div>
      <span className="mb-1 block text-sm text-ink-2">Password</span>
      <div className="relative">
        <input
          name="password"
          type={show ? "text" : "password"}
          required
          className="w-full rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper px-3 py-2 pe-16 text-sm text-ink placeholder:text-faint focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--isl-oxblood)] transition"
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute end-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-brass-ink hover:text-oxblood-deep transition"
        >
          {show ? "HIDE" : "SHOW"}
        </button>
      </div>
      {show && (
        <p className="mt-1 text-[10px] text-status-warning">
          ⚠ Password is visible — share it securely with the user
        </p>
      )}
    </div>
  );
}
