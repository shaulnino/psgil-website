"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ImageUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { uploadDriverPhotoAction, type FormState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];

/**
 * Polished driver-photo uploader: click or drag an image into the frame, see a
 * live preview of the chosen file, then Save (reuses `uploadDriverPhotoAction`,
 * which redirects on success so the saved photo shows). Client-side type/size
 * validation mirrors the server. No native "No file chosen" chrome.
 */
export default function DriverImageUploader({ currentPhotoUrl }: { currentPhotoUrl: string | null }) {
  const t = useTranslations("account.account");
  const [state, action, pending] = useActionState<FormState, FormData>(uploadDriverPhotoAction, undefined);
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const accept = (file: File | undefined): void => {
    if (!file) return;
    if (!ALLOWED.includes(file.type)) {
      setLocalError(t("photoBadType"));
      return;
    }
    if (file.size > MAX_BYTES) {
      setLocalError(t("photoTooLarge"));
      return;
    }
    setLocalError(null);
    setFileName(file.name);
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(file);
    });
  };

  const clear = () => {
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return null;
    });
    setFileName(null);
    setLocalError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const displaySrc = preview ?? currentPhotoUrl;
  const error = localError ?? state?.error ?? null;

  return (
    <form action={action} className="space-y-3">
      <div className="flex items-start gap-4">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files?.[0];
            if (file && inputRef.current) {
              const dt = new DataTransfer();
              dt.items.add(file);
              inputRef.current.files = dt.files;
            }
            accept(file);
          }}
          aria-label={t("photoReplace")}
          className={`relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-[2px] border border-dashed bg-sink transition-colors ${
            dragOver ? "border-oxblood" : "border-[color:var(--isl-hairline-strong)] hover:border-ink"
          }`}
        >
          {displaySrc ? (
            <Image src={displaySrc} alt="" fill sizes="96px" className="object-cover" unoptimized />
          ) : (
            <ImageUp className="h-6 w-6 text-faint" aria-hidden />
          )}
        </button>

        <div className="min-w-0 text-sm">
          <p className="text-meta">{fileName ? <bdi className="text-ink">{fileName}</bdi> : t("photoDrop")}</p>
          <p className="mt-1 text-xs text-faint">{t("photoHint")}</p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        name="photo"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        onChange={(e) => accept(e.target.files?.[0] ?? undefined)}
      />

      {error && (
        <p role="alert" className="text-sm text-[color:var(--isl-danger)]">
          {error}
        </p>
      )}

      {fileName && (
        <div className="flex items-center gap-3">
          <Button type="submit" variant="secondary" size="sm" loading={pending}>
            {t("photoSave")}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={clear} disabled={pending}>
            {t("photoCancel")}
          </Button>
        </div>
      )}
    </form>
  );
}
