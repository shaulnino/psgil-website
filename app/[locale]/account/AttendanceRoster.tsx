import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { ATTENDANCE_STATUSES, type AttendanceStatus } from "@/lib/attendance/types";
import type { AttendanceRoster as RosterData } from "@/lib/attendance/roster";

const tone: Record<AttendanceStatus, string> = {
  going: "var(--isl-success)",
  maybe: "var(--isl-warning)",
  out: "var(--isl-danger)",
};

/** Read-only "who's racing" list for the next race, grouped by status (PW-3.2). */
export default async function AttendanceRoster({ roster }: { roster: RosterData }) {
  const t = await getTranslations("attendance");
  const total = ATTENDANCE_STATUSES.reduce((n, s) => n + roster[s].length, 0);

  return (
    <div>
      <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-meta">{t("rosterTitle")}</h3>
      {total === 0 ? (
        <p className="mt-2 text-sm text-meta">{t("rosterEmpty")}</p>
      ) : (
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          {ATTENDANCE_STATUSES.map((status) => (
            <div key={status}>
              <div
                className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.06em]"
                style={{ color: tone[status] }}
              >
                <span>{t(`status.${status}`)}</span>
                <span className="num text-meta">({roster[status].length})</span>
              </div>
              {roster[status].length === 0 ? (
                <p className="text-xs text-faint">—</p>
              ) : (
                <ul className="space-y-1.5">
                  {roster[status].map((e) => (
                    <li key={e.driverId} className="flex items-center gap-2 text-sm text-ink-2">
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
                      <span className="text-ink">{e.name}</span>
                      {e.teamName && <span className="text-xs text-meta">{e.teamName}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
