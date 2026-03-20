"use client";

import { useEffect, useRef, useState } from "react";

type PastedImage = { id: string; file: File; previewUrl: string };

export default function EvidencePasteBox() {
  const [images, setImages] = useState<PastedImage[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dropZoneRef = useRef<HTMLDivElement | null>(null);

  // sync pasted images into hidden file input for form submission
  useEffect(() => {
    const input = fileInputRef.current;
    if (!input) return;
    const dt = new DataTransfer();
    for (const img of images) dt.items.add(img.file);
    input.files = dt.files;
  }, [images]);

  const addImageFile = (file: File) => {
    const id = `${Date.now()}-${Math.random()}`;
    const previewUrl = URL.createObjectURL(file);
    setImages((prev) => [...prev, { id, file, previewUrl }]);
  };

  const removeImage = (id: string) => {
    setImages((prev) => {
      const removed = prev.find((i) => i.id === id);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return prev.filter((i) => i.id !== id);
    });
  };

  // global paste listener — captures images pasted anywhere on the page
  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      const items = Array.from(e.clipboardData?.items ?? []);
      const imageItems = items.filter((i) => i.type.startsWith("image/"));
      if (imageItems.length === 0) return;
      e.preventDefault();
      for (const item of imageItems) {
        const file = item.getAsFile();
        if (file) addImageFile(file);
      }
    };
    window.addEventListener("paste", handler);
    return () => window.removeEventListener("paste", handler);
  }, []);

  // drag-and-drop support
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dropZoneRef.current?.classList.remove("border-[#D4AF37]");
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
    for (const f of files) addImageFile(f);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    dropZoneRef.current?.classList.add("border-[#D4AF37]");
  };

  const handleDragLeave = () => {
    dropZoneRef.current?.classList.remove("border-[#D4AF37]");
  };

  return (
    <div className="md:col-span-2 space-y-3">
      {/* hidden file input consumed by server action as attachment_files */}
      <input
        ref={fileInputRef}
        type="file"
        name="attachment_files"
        multiple
        accept="image/*"
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
        readOnly
      />

      <div
        ref={dropZoneRef}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className="flex min-h-[72px] cursor-default items-center justify-center rounded-xl border border-dashed border-[#D4AF37]/40 bg-black/20 px-4 py-4 text-center transition-colors duration-150"
      >
        {images.length === 0 ? (
          <p className="text-sm text-white/50">
            <span className="font-semibold text-[#D4AF37]">Paste a screenshot</span> anywhere (Ctrl+V) or drop an image here
          </p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {images.map((img) => (
              <div key={img.id} className="group relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.previewUrl}
                  alt={img.file.name}
                  className="h-20 w-28 rounded-lg border border-[#D4AF37]/30 object-cover shadow-md"
                />
                <button
                  type="button"
                  onClick={() => removeImage(img.id)}
                  className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white opacity-0 shadow transition-opacity group-hover:opacity-100"
                  aria-label="Remove image"
                >
                  ✕
                </button>
                <p className="mt-1 max-w-[112px] truncate text-[10px] text-white/50">{img.file.name}</p>
              </div>
            ))}
            <button
              type="button"
              onClick={() => dropZoneRef.current?.dispatchEvent(new Event("click"))}
              className="flex h-20 w-28 items-center justify-center rounded-lg border border-dashed border-[#D4AF37]/30 text-xs text-white/40 hover:border-[#D4AF37]/70 hover:text-white/70 transition-colors"
            >
              + Add more
            </button>
          </div>
        )}
      </div>

      <p className="text-[11px] text-white/45">
        Screenshots pasted via Ctrl+V are attached automatically. You can also drag &amp; drop image files above.
      </p>
    </div>
  );
}
