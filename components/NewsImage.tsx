"use client";

import { useEffect, useState } from "react";

type NewsImageProps = {
  src?: string;
  alt: string;
  className?: string;
  fallbackSrc?: string;
  loading?: "lazy" | "eager";
};

const DEFAULT_FALLBACK = "/psgil-banner.png";

export default function NewsImage({
  src,
  alt,
  className = "",
  fallbackSrc = DEFAULT_FALLBACK,
  loading = "lazy",
}: NewsImageProps) {
  const cleanSrc = (src ?? "").trim();
  const [currentSrc, setCurrentSrc] = useState(cleanSrc || fallbackSrc);

  useEffect(() => {
    setCurrentSrc(cleanSrc || fallbackSrc);
  }, [cleanSrc, fallbackSrc]);

  return (
    <img
      src={currentSrc}
      alt={alt}
      loading={loading}
      className={className}
      onError={() => setCurrentSrc(fallbackSrc)}
    />
  );
}

