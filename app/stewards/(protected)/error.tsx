"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export default function StewardsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("stewards");
  useEffect(() => {
    console.error("[Stewards] Client error:", error);
  }, [error]);

  const isChunkError =
    error?.message?.toLowerCase().includes("loading chunk") ||
    error?.message?.toLowerCase().includes("failed to fetch") ||
    error?.name === "ChunkLoadError";

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6">
      <div className="w-full max-w-md rounded-[2px] border border-status-danger bg-paper p-8 text-center">
        <p className="text-4xl text-status-danger">⚠</p>
        <h2 className="mt-4 font-display text-lg font-bold tracking-[0.005em] leading-[1.05] text-ink">{t("shell.error.title")}</h2>

        {isChunkError ? (
          <p className="mt-2 text-sm text-ink-2">
            {t.rich("shell.error.chunkMessage", {
              strong: (chunks) => <strong className="text-ink">{chunks}</strong>,
            })}
          </p>
        ) : (
          <p className="mt-2 text-sm text-ink-2">
            {t("shell.error.genericMessage")}
          </p>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button variant="primary" size="md" onClick={() => window.location.reload()}>
            {t("shell.error.reload")}
          </Button>
          <Button variant="secondary" size="md" onClick={reset}>
            {t("shell.error.tryAgain")}
          </Button>
        </div>

        {(error?.message || error?.digest) && (
          <details className="mt-4 text-start">
            <summary className="cursor-pointer font-mono text-[10px] text-faint hover:text-meta">
              {t("shell.error.debugInfo")}
            </summary>
            <div className="mt-1 rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream p-3 font-mono text-[10px] text-meta break-all space-y-1">
              {error.digest && <p>{t("shell.error.digest", { value: error.digest })}</p>}
              {error.message && error.message !== "An error occurred in the Server Components render." && (
                <p>{t("shell.error.message", { value: error.message })}</p>
              )}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
