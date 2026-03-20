"use client";

import { useRef, useState } from "react";

export default function AttachmentFilePicker() {
  const ref = useRef<HTMLInputElement | null>(null);
  const [summary, setSummary] = useState("No files selected");
  return (
    <div>
      <span className="mb-1 block text-sm text-white/80">Attachments (upload from computer)</span>
      <input
        ref={ref}
        type="file"
        name="attachment_files"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = e.currentTarget.files;
          if (!files || files.length === 0) return setSummary("No files selected");
          if (files.length === 1) return setSummary(files[0].name);
          setSummary(`${files.length} files selected`);
        }}
      />
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => ref.current?.click()} className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white/90">Choose files</button>
        <span className="text-xs text-white/60">{summary}</span>
      </div>
    </div>
  );
}
