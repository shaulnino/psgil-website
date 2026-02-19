"use client";

/* ------------------------------------------------------------------ */
/*  Google Analytics 4 — route-change tracker                          */
/*  ----------------------------------------------------------------  */
/*  Mounted once in app/layout.tsx.                                    */
/*  Uses usePathname() + useSearchParams() to fire a page_view event   */
/*  on every SPA navigation.                                           */
/*                                                                     */
/*  The gtag.js library + config snippet are loaded via <Script> in    */
/*  app/layout.tsx.  This component only sends subsequent page_view    */
/*  events after the initial load (GA auto-tracks the first one).      */
/* ------------------------------------------------------------------ */

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { GA_ID, isGaEnabled } from "@/lib/ga";

export default function GoogleAnalytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isFirstRender = useRef(true);

  useEffect(() => {
    // Skip the very first render — GA config already fires a page_view
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (!isGaEnabled()) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gtag = (window as any).gtag;
    if (typeof gtag !== "function") return;

    const url =
      pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : "");

    gtag("event", "page_view", {
      page_path: pathname,
      page_location: window.location.origin + url,
      page_title: document.title,
    });
  }, [pathname, searchParams]);

  // This component renders nothing — it's purely a side-effect hook
  return null;
}
