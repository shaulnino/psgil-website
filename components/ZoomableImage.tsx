"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

type ZoomableImageProps = {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  sizes?: string;
  quality?: number;
  priority?: boolean;
  fill?: boolean;
  triggerClassName?: string;
  imageClassName?: string;
  modalImageClassName?: string;
};

export default function ZoomableImage({
  src,
  alt,
  width = 2000,
  height = 1200,
  sizes = "100vw",
  quality = 100,
  priority,
  fill,
  triggerClassName = "",
  imageClassName = "",
  modalImageClassName = "",
}: ZoomableImageProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setZoom(1);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    closeButtonRef.current?.focus();

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const clampZoom = (value: number) => Math.min(3, Math.max(1, value));

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (zoom <= 1 || !scrollContainerRef.current) {
      return;
    }

    scrollContainerRef.current.setPointerCapture(event.pointerId);
    setIsDragging(true);
    dragStart.current = {
      x: event.clientX,
      y: event.clientY,
      scrollLeft: scrollContainerRef.current.scrollLeft,
      scrollTop: scrollContainerRef.current.scrollTop,
    };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !scrollContainerRef.current) {
      return;
    }

    const dx = event.clientX - dragStart.current.x;
    const dy = event.clientY - dragStart.current.y;
    scrollContainerRef.current.scrollLeft = dragStart.current.scrollLeft - dx;
    scrollContainerRef.current.scrollTop = dragStart.current.scrollTop - dy;
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!scrollContainerRef.current) {
      return;
    }

    scrollContainerRef.current.releasePointerCapture(event.pointerId);
    setIsDragging(false);
  };

  return (
    <>
      <div
        className={triggerClassName}
        role="button"
        tabIndex={0}
        onClick={() => setIsOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            setIsOpen(true);
          }
        }}
      >
        <Image
          src={src}
          alt={alt}
          width={fill ? undefined : width}
          height={fill ? undefined : height}
          fill={fill}
          sizes={sizes}
          quality={quality}
          priority={priority}
          className={imageClassName}
        />
      </div>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="relative mx-4 w-full max-w-6xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
              <div className="flex items-center gap-1 rounded-full border border-white/20 bg-black/60 p-1">
                <button
                  onClick={() => setZoom((value) => clampZoom(value - 0.2))}
                  aria-label="Zoom out"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-white/80 transition hover:text-white"
                >
                  −
                </button>
                <button
                  onClick={() => setZoom(1)}
                  aria-label="Reset zoom"
                  className="px-2 text-xs uppercase tracking-[0.2em] text-white/60 transition hover:text-white"
                >
                  100%
                </button>
                <button
                  onClick={() => setZoom((value) => clampZoom(value + 0.2))}
                  aria-label="Zoom in"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-white/80 transition hover:text-white"
                >
                  +
                </button>
              </div>
              <button
                ref={closeButtonRef}
                onClick={() => setIsOpen(false)}
                aria-label="Close image preview"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white/80 transition hover:border-[#7020B0]/60 hover:text-white"
              >
                ×
              </button>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#0B0B0E] p-3 shadow-[0_0_30px_rgba(0,0,0,0.4)]">
              <div
                ref={scrollContainerRef}
                className={`max-h-[85vh] overflow-auto ${
                  zoom > 1 ? "cursor-grab" : "cursor-default"
                } ${isDragging ? "cursor-grabbing" : ""}`}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={() => setIsDragging(false)}
                style={{ touchAction: zoom > 1 ? "none" : "auto" }}
              >
                <Image
                  src={src}
                  alt={alt}
                  width={width}
                  height={height}
                  sizes={sizes}
                  quality={quality}
                  priority
                  className={`h-auto w-full object-contain transition-transform ${modalImageClassName}`}
                  style={{ width: `${zoom * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
