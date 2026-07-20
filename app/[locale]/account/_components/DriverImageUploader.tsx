"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Cropper, { type Area, type Point } from "react-easy-crop";
import { ImageUp } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  removeDriverPhotoAction,
  uploadDriverPhotoAction,
  type FormState,
} from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { getCroppedBlob } from "./cropImage";

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
  const [removeState, removeAction, removePending] = useActionState<FormState, FormData>(removeDriverPhotoAction, undefined);
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  // Cropping state — `cropSrc` is the raw picked image; when set, the crop
  // dialog is open. The user pans/zooms; on Apply we render a square JPEG.
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [cropping, setCropping] = useState(false);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  useEffect(() => {
    return () => {
      if (cropSrc) URL.revokeObjectURL(cropSrc);
    };
  }, [cropSrc]);

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
    // Open the cropper instead of committing the file straight away.
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setCropSrc((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(file);
    });
  };

  const onCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const cancelCrop = () => {
    setCropSrc((old) => {
      if (old) URL.revokeObjectURL(old);
      return null;
    });
    setCroppedAreaPixels(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const applyCrop = async () => {
    if (!cropSrc || !croppedAreaPixels) return;
    setCropping(true);
    try {
      const blob = await getCroppedBlob(cropSrc, croppedAreaPixels);
      const file = new File([blob], "driver-photo.jpg", { type: "image/jpeg" });
      if (inputRef.current) {
        const dt = new DataTransfer();
        dt.items.add(file);
        inputRef.current.files = dt.files;
      }
      setFileName(file.name);
      setPreview((old) => {
        if (old) URL.revokeObjectURL(old);
        return URL.createObjectURL(blob);
      });
      setLocalError(null);
      setCropSrc((old) => {
        if (old) URL.revokeObjectURL(old);
        return null;
      });
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : t("photoBadType"));
    } finally {
      setCropping(false);
    }
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
  const error = localError ?? state?.error ?? removeState?.error ?? null;
  const hasPhoto = !!currentPhotoUrl;

  return (
    <div className="space-y-3">
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

    {/* When a photo already exists (and no new file is staged), offer explicit
        Replace / Remove actions. The remove form is a sibling — not nested in
        the upload form — since nested forms are invalid. */}
    {!fileName && hasPhoto && (
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={removePending}
        >
          {t("photoReplace")}
        </Button>
        {confirmRemove ? (
          <form action={removeAction} className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-meta">{t("photoRemoveConfirm")}</span>
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              loading={removePending}
              className="text-[color:var(--isl-danger)] hover:border-[color:var(--isl-danger)] hover:text-[color:var(--isl-danger)]"
            >
              {t("photoRemoveCta")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setConfirmRemove(false)}
              disabled={removePending}
            >
              {t("photoCancel")}
            </Button>
          </form>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setConfirmRemove(true)}
            className="text-[color:var(--isl-danger)] hover:border-[color:var(--isl-danger)] hover:text-[color:var(--isl-danger)]"
          >
            {t("photoRemove")}
          </Button>
        )}
      </div>
    )}

    {cropSrc && (
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("photoCropTitle")}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      >
        <div className="w-full max-w-md rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream p-4 shadow-xl">
          <p className="mb-3 font-isl-body text-sm font-semibold uppercase tracking-[0.15em] text-oxblood">
            {t("photoCropTitle")}
          </p>

          <div className="relative h-64 w-full overflow-hidden rounded-[2px] bg-black">
            <Cropper
              image={cropSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              showGrid={false}
            />
          </div>

          <label className="mt-4 flex items-center gap-3 text-xs text-meta">
            <span className="w-12 shrink-0 font-semibold uppercase tracking-wider text-oxblood">
              {t("photoZoom")}
            </span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="h-1 w-full cursor-pointer accent-oxblood"
              aria-label={t("photoZoom")}
            />
          </label>

          <div className="mt-4 flex items-center justify-end gap-3">
            <Button type="button" variant="ghost" size="sm" onClick={cancelCrop} disabled={cropping}>
              {t("photoCancel")}
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={applyCrop} loading={cropping}>
              {t("photoCropApply")}
            </Button>
          </div>
        </div>
      </div>
    )}
    </div>
  );
}
