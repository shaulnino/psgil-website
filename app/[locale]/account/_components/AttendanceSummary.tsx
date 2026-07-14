"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { ATTENDANCE_STATUSES, type AttendanceStatus } from "@/lib/attendance/types";
import type { AttendanceRoster } from "@/lib/attendance/roster";

const tone: Record<AttendanceStatus, string> = {
  going: "var(--isl-success)",
  maybe: "var(--isl-warning)",
  out: "var(--isl-danger)",
};

/**
 * Compact "who's racing" summary: a count chip per status is always visible;
 * the names expand on demand (no permanently empty three-column grid). Team
 * logos shown where available; English names are direction-isolated for RTL.
 */
export default function AttendanceSummary({ roster }: { roster: AttendanceRoster }) {
  const t = useTranslations("attendance");
  const [open, setOpen] = useState(false);
  const total = ATTENDANCE_STATUSES.reduce((n, s) => n + roster[s].length, 0);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-meta">{t("rosterTitle")}</h3>
        {total > 0 && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.06em] text-meta transition-colors hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--isl-oxblood)]"
          >
            {open ? t("hideNames") : t("showNames")}
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
          </button>
        )}
      </div>

      {total === 0 ? (
        <p className="mt-2 text-sm text-meta">{t("rosterEmpty")}</p>
      ) : (
        <>
          {/* Always-visible counts */}
          <div className="mt-3 flex flex-wrap gap-2">
            {ATTENDANCE_STATUSES.map((status) => (
              <span
                key={status}
                className="inline-flex items-center gap-1.5 rounded-[2px] border border-[color:var(--isl-hairline-strong)] px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.06em]"
                style={{ color: tone[status] }}
              >
                {t(`status.${status}`)}
                <span className="num text-meta">{roster[status].length}</span>
              </span>
            ))}
          </div>

          {/* Expandable names */}
          {open && (
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              {ATTENDANCE_STATUSES.map((status) => (
                <div key={status}>
                  <div
                    className="mb-2 text-xs font-bold uppercase tracking-[0.06em]"
                    style={{ color: tone[status] }}
                  >
                    {t(`status.${status}`)}
                  </div>
                  {roster[status].length === 0 ? (
                    <p className="text-xs text-faint">—</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {roster[status].map((e) => (
                        <li key={e.driverId} className="flex items-center gap-2 text-sm">
                          {e.teamLogo && (
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[2px] bg-white p-0.5">
                              <Image
                                src={e.teamLogo}
                                alt=""
                                width={20}
                                height={20}
                                className="h-full w-full object-contain"
                                unoptimized
                              />
                            </span>
                          )}
                          <bdi className="text-ink">{e.name}</bdi>
                          {e.teamName && <bdi className="text-xs text-meta">{e.teamName}</bdi>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
