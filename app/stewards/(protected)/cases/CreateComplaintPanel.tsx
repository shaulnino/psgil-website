"use client";

import { useState } from "react";

export default function CreateComplaintPanel({
  initiallyOpen = false,
  children,
}: {
  initiallyOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <section className="steward-panel rounded-2xl p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">Create Complaint</h3>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-full bg-[#7020B0] px-4 py-2 text-sm font-semibold text-white transition hover:shadow-[0_0_14px_rgba(143,132,112,0.12)]"
        >
          {open ? "Close" : "Create Complaint"}
        </button>
      </div>
      {open && <div className="mt-4">{children}</div>}
    </section>
  );
}
