"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { setAttendanceAction, type AttendanceState } from "@/lib/attendance/actions";
import type { AttendanceStatus } from "@/lib/attendance/types";

export type AttendanceRaceView = {
  raceId: string;
  /** Localized, display-ready race label. */
  label: string;
  /** Localized, display-ready date/time label. */
  dateLabel: string;
  currentStatus: AttendanceStatus | null;
};

const STATUS_ORDER: AttendanceStatus[] = ["going", "maybe", "out"];

const activeClass: Record<AttendanceStatus, string> = {
  going: "border-[color:var(--isl-success)] bg-[color:var(--isl-success)]/15 text-ink",
  maybe: "border-[color:var(--isl-warning)] bg-[color:var(--isl-warning)]/15 text-ink",
  out: "border-[color:var(--isl-danger)] bg-[color:var(--isl-danger)]/10 text-ink",
};

function AttendanceRow({ race }: { race: AttendanceRaceView }) {
  const t = useTranslations("attendance");
  const [state, action, pending] = useActionState<AttendanceState, FormData>(
    setAttendanceAction,
    undefined,
  );

  return (
    <li className="border-t border-[color:var(--isl-hairline)] pt-4 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-ink">{race.label}</div>
          <div className="text-xs text-meta">{race.dateLabel}</div>
        </div>
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
      </div>
      {state?.error && (
        <p role="alert" className="mt-2 text-xs text-[color:var(--isl-danger)]">
          {state.error}
        </p>
      )}
    </li>
  );
}

export default function AttendanceSection({ races }: { races: AttendanceRaceView[] }) {
  const t = useTranslations("attendance");

  if (races.length === 0) {
    return <p className="text-sm text-meta">{t("noRaces")}</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-meta">{t("hint")}</p>
      <ul className="space-y-4">
        {races.map((race) => (
          <AttendanceRow key={race.raceId} race={race} />
        ))}
      </ul>
    </div>
  );
}
