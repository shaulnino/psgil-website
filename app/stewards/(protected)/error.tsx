"use client";

import { useEffect } from "react";

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
      <div className="w-full max-w-md rounded-2xl border border-red-500/30 bg-red-500/8 p-8 text-center">
        <p className="text-4xl">⚠</p>
        <h2 className="mt-4 text-lg font-bold text-white">Something went wrong</h2>

        {isChunkError ? (
          <p className="mt-2 text-sm text-white/65">
            The page failed to load properly. This usually happens after a site update. Please do a
            hard refresh (<strong className="text-white/80">Ctrl + Shift + R</strong> on Windows,{" "}
            <strong className="text-white/80">Cmd + Shift + R</strong> on Mac) to get the latest
            version.
          </p>
        ) : (
          <p className="mt-2 text-sm text-white/65">
            An unexpected error occurred. Try refreshing the page or going back.
          </p>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => window.location.reload()}
            className="rounded-full bg-[#7020B0] px-5 py-2.5 text-sm font-semibold transition hover:bg-[#7c2ac3]"
          >
            Reload page
          </button>
          <button
            onClick={reset}
            className="rounded-full border border-white/20 px-5 py-2.5 text-sm text-white/70 transition hover:border-white/40 hover:text-white"
          >
            Try again
          </button>
        </div>

        {(error?.message || error?.digest) && (
          <details className="mt-4 text-left">
            <summary className="cursor-pointer font-mono text-[10px] text-white/25 hover:text-white/40">
              Debug info
            </summary>
            <div className="mt-1 rounded-lg border border-white/10 bg-black/40 p-3 font-mono text-[10px] text-white/40 break-all space-y-1">
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
