"use client";

import { useEffect, useState } from "react";

export default function SubmissionToast() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 3500);
    return () => clearTimeout(t);
  }, []);
  if (!visible) return null;
  return (
    <div className="fixed end-5 top-5 z-50 max-w-sm rounded-[2px] border border-status-success bg-paper px-4 py-3 text-sm text-status-success">
      Complaint submitted successfully.
    </div>
  );
}
