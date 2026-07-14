"use client";

import { useActionState } from "react";
import { Check, HelpCircle, X, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { setAttendanceAction, type AttendanceState } from "@/lib/attendance/actions";
import type { AttendanceStatus } from "@/lib/attendance/types";

const STATUS_ORDER: AttendanceStatus[] = ["going", "maybe", "out"];
const ICONS: Record<AttendanceStatus, LucideIcon> = { going: Check, maybe: HelpCircle, out: X };
const activeClass: Record<AttendanceStatus, string> = {
  going: "border-[color:var(--isl-success)] bg-[color:var(--isl-success)]/15 text-ink",
  maybe: "border-[color:var(--isl-warning)] bg-[color:var(--isl-warning)]/15 text-ink",
  out: "border-[color:var(--isl-danger)] bg-[color:var(--isl-danger)]/10 text-ink",
};

/**
 * Driver RSVP segmented control. Immediate-save (each option submits the server
 * action, gated to the open window + linked driver). Shape-first: icon + label
 * carry meaning, colour only confirms the active state.
 */
export default function AttendanceSelector({
  raceId,
  currentStatus,
  editable,
}: {
  raceId: string;
  currentStatus: AttendanceStatus | null;
  editable: boolean;
}) {
  const t = useTranslations("attendance");
  const [state, action, pending] = useActionState<AttendanceState, FormData>(
    setAttendanceAction,
    undefined,
  );

  if (!editable) {
    return (
      <div>
        <span className="text-xs uppercase tracking-[0.1em] text-meta">{t("yourResponse")}: </span>
        {currentStatus ? (
          <span
            className={`ms-1 inline-flex items-center gap-1.5 rounded-[2px] border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.06em] ${activeClass[currentStatus]}`}
          >
            {t(`status.${currentStatus}`)}
          </span>
        ) : (
          <span className="text-xs text-faint">{t("noResponse")}</span>
        )}
      </div>
    );
  }

  return (
    <div>
      <form
        action={action}
        className="inline-grid w-full grid-cols-3 gap-2"
        aria-label={t("yourResponse")}
      >
        <input type="hidden" name="raceId" value={raceId} />
        {STATUS_ORDER.map((status) => {
          const Icon = ICONS[status];
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
                "flex items-center justify-center gap-1.5 rounded-[2px] border px-3 py-2 text-xs font-semibold uppercase tracking-[0.06em] transition-colors disabled:opacity-60",
                isActive
                  ? activeClass[status]
                  : "border-[color:var(--isl-hairline-strong)] text-meta hover:border-ink hover:text-ink",
              ].join(" ")}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} aria-hidden />
              {t(`status.${status}`)}
            </button>
          );
        })}
      </form>
      {state?.error && (
        <p role="alert" className="mt-2 text-xs text-[color:var(--isl-danger)]">
          {state.error}
        </p>
      )}
    </div>
  );
}
