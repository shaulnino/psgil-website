"use client";

import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";

export default function AttachmentFilePicker() {
  const ref = useRef<HTMLInputElement | null>(null);
  const [summary, setSummary] = useState("No files selected");
  return (
    <div>
      <span className="mb-1 block text-sm text-ink-2">Attachments (upload from computer)</span>
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
        <Button type="button" variant="secondary" size="sm" onClick={() => ref.current?.click()}>Choose files</Button>
        <span className="text-xs text-meta">{summary}</span>
      </div>
    </div>
  );
}
