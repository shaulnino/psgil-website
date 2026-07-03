"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

export default function AttachmentFilePicker() {
  const t = useTranslations("stewards");
  const ref = useRef<HTMLInputElement | null>(null);
  const [summary, setSummary] = useState(t("cases.attachments.noFiles"));
  return (
    <div>
      <span className="mb-1 block text-sm text-ink-2">{t("cases.attachments.label")}</span>
      <input
        ref={ref}
        type="file"
        name="attachment_files"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = e.currentTarget.files;
          if (!files || files.length === 0) return setSummary(t("cases.attachments.noFiles"));
          if (files.length === 1) return setSummary(files[0].name);
          setSummary(t("cases.attachments.filesSelected", { count: files.length }));
        }}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="secondary" size="sm" onClick={() => ref.current?.click()}>{t("cases.attachments.chooseFiles")}</Button>
        <span className="text-xs text-meta">{summary}</span>
      </div>
    </div>
  );
}
