import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/**
 * Locale-aware navigation wrappers. Use these `Link`/`useRouter`/`usePathname`
 * (instead of next/navigation) for PUBLIC links so the current locale prefix is
 * preserved automatically (e.g. an English page's links stay under /en/*).
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
