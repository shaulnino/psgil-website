"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { adminSetAttendanceAction, type AttendanceState } from "@/lib/attendance/actions";
import { ATTENDANCE_STATUSES, type AttendanceStatus } from "@/lib/attendance/types";

const activeClass: Record<AttendanceStatus, string> = {
  going: "border-[color:var(--isl-success)] bg-[color:var(--isl-success)]/15 text-ink",
  maybe: "border-[color:var(--isl-warning)] bg-[color:var(--isl-warning)]/15 text-ink",
  out: "border-[color:var(--isl-danger)] bg-[color:var(--isl-danger)]/10 text-ink",
};

export default function AttendanceAdminControls({
  raceId,
  driverId,
  currentStatus,
}: {
  raceId: string;
  driverId: string;
  currentStatus: AttendanceStatus | null;
}) {
  const t = useTranslations("attendance");
  const [state, action, pending] = useActionState<AttendanceState, FormData>(
    adminSetAttendanceAction,
    undefined,
  );

  return (
    <div>
      <form action={action} className="flex flex-wrap items-center gap-1.5">
        <input type="hidden" name="raceId" value={raceId} />
        <input type="hidden" name="driverId" value={driverId} />
        {ATTENDANCE_STATUSES.map((status) => {
          const isActive = currentStatus === status;
          return (
            <button
              key={status}
              type="submit"
              name="status"
              value={status}
              disabled={pending}
              aria-pressed={isActive}
              className={[
                "rounded-[2px] border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] transition-colors disabled:opacity-60",
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
      {state?.error && (
        <p role="alert" className="mt-1 text-[10px] text-[color:var(--isl-danger)]">
          {state.error}
        </p>
      )}
    </div>
  );
}
