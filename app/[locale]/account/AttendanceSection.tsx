"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { setAttendanceAction, type AttendanceState } from "@/lib/attendance/actions";
import type { AttendanceStatus } from "@/lib/attendance/types";

export type AttendanceNextRaceView = {
  raceId: string;
  /** Localized, display-ready race label. */
  label: string;
  /** Localized, display-ready date/time label. */
  dateLabel: string;
  currentStatus: AttendanceStatus | null;
  /** RSVP window is open — the driver can change their answer. */
  editable: boolean;
  /** Localized notice about the window (opens / closes / closed), or null. */
  notice: string | null;
};

const STATUS_ORDER: AttendanceStatus[] = ["going", "maybe", "out"];

const activeClass: Record<AttendanceStatus, string> = {
  going: "border-[color:var(--isl-success)] bg-[color:var(--isl-success)]/15 text-ink",
  maybe: "border-[color:var(--isl-warning)] bg-[color:var(--isl-warning)]/15 text-ink",
  out: "border-[color:var(--isl-danger)] bg-[color:var(--isl-danger)]/10 text-ink",
};

export default function AttendanceSection({ race }: { race: AttendanceNextRaceView | null }) {
  const t = useTranslations("attendance");
  const [state, action, pending] = useActionState<AttendanceState, FormData>(
    setAttendanceAction,
    undefined,
  );

  if (!race) {
    return <p className="text-sm text-meta">{t("noRaces")}</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-meta">{t("hint")}</p>

      <div className="border-t border-[color:var(--isl-hairline)] pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-ink">{race.label}</div>
            <div className="text-xs text-meta">{race.dateLabel}</div>
          </div>

          {race.editable ? (
            <form action={action} className="flex items-center gap-2">
              <input type="hidden" name="raceId" value={race.raceId} />
              {STATUS_ORDER.map((status) => {
                const isActive = race.currentStatus === status;
                return (
                  <button
                    key={status}
                    type="submit"
                    name="status"
                    value={status}
                    disabled={pending}
                    aria-pressed={isActive}
                    className={[
                      "rounded-[2px] border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.06em] transition-colors disabled:opacity-60",
                      isActive
                        ? activeClass[status]
                        : "border-[color:var(--isl-hairline-strong)] text-meta hover:border-ink hover:text-ink",
                    ].join(" ")}
                  >
                    {t(`status.${status}`)}
                  </button>
                );
              })}
            </form>
          ) : race.currentStatus ? (
            <span
              className={`rounded-[2px] border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.06em] ${activeClass[race.currentStatus]}`}
            >
              {t(`status.${race.currentStatus}`)}
            </span>
          ) : (
            <span className="text-xs text-faint">{t("noResponse")}</span>
          )}
        </div>

        {race.notice && <p className="mt-2 text-xs text-meta">{race.notice}</p>}
        {state?.error && (
          <p role="alert" className="mt-2 text-xs text-[color:var(--isl-danger)]">
            {state.error}
          </p>
        )}
      </div>
    </div>
  );
}
