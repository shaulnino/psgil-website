"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function CreateComplaintPanel({
  initiallyOpen = false,
  children,
}: {
  initiallyOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <section className="steward-panel rounded-[2px] p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display font-bold tracking-[0.005em] leading-[1.05] text-ink text-lg">
          Create Complaint
        </h3>
        <Button
          type="button"
          variant={open ? "secondary" : "primary"}
          size="sm"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Close" : "Create Complaint"}
        </Button>
      </div>
      {open && <div className="mt-4">{children}</div>}
    </section>
  );
}
