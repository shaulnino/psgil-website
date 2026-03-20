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
    <div className="fixed right-5 top-5 z-50 max-w-sm rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-4 py-3 text-sm text-emerald-100 shadow-xl">
      Complaint submitted successfully.
    </div>
  );
}
