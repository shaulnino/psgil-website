"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function StewardsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
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
        <h2 className="mt-4 font-display text-lg font-bold tracking-[0.005em] leading-[1.05] text-ink">Something went wrong</h2>

        {isChunkError ? (
          <p className="mt-2 text-sm text-ink-2">
            The page failed to load properly. This usually happens after a site update. Please do a
            hard refresh (<strong className="text-ink">Ctrl + Shift + R</strong> on Windows,{" "}
            <strong className="text-ink">Cmd + Shift + R</strong> on Mac) to get the latest
            version.
          </p>
        ) : (
          <p className="mt-2 text-sm text-ink-2">
            An unexpected error occurred. Try refreshing the page or going back.
          </p>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button variant="primary" size="md" onClick={() => window.location.reload()}>
            Reload page
          </Button>
          <Button variant="secondary" size="md" onClick={reset}>
            Try again
          </Button>
        </div>

        {(error?.message || error?.digest) && (
          <details className="mt-4 text-start">
            <summary className="cursor-pointer font-mono text-[10px] text-faint hover:text-meta">
              Debug info
            </summary>
            <div className="mt-1 rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream p-3 font-mono text-[10px] text-meta break-all space-y-1">
              {error.digest && <p>Digest: {error.digest}</p>}
              {error.message && error.message !== "An error occurred in the Server Components render." && (
                <p>Message: {error.message}</p>
              )}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
