import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Section from "@/components/Section";
import LoadingLink from "@/components/LoadingLink";
import { requireAdmin } from "@/lib/auth/session";
import { fetchCsv, parseCsv } from "@/lib/csv";
import { mapDrivers } from "@/lib/driversData";
import { GLOBAL_CSV_URLS } from "@/lib/seasonConfig";
import { fetchUpcomingRaces } from "@/lib/attendance/races";
import { listAttendanceForRace } from "@/lib/attendance/repository";
import { ATTENDANCE_STATUSES, type AttendanceStatus } from "@/lib/attendance/types";

export const metadata: Metadata = { title: "Attendance | F1ISL" };
export const dynamic = "force-dynamic";

const card = "rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream p-5 md:p-6";
const h2 = "font-display text-lg font-bold tracking-[0.02em] text-ink";

const tone: Record<AttendanceStatus, string> = {
  going: "var(--isl-success)",
  maybe: "var(--isl-warning)",
  out: "var(--isl-danger)",
};

export default async function AttendanceAdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  await requireAdmin("/admin/attendance");
  const { locale } = await params;
  const t = await getTranslations("attendance");

  const [upcoming, driversCsv] = await Promise.all([
    fetchUpcomingRaces(),
    fetchCsv(GLOBAL_CSV_URLS.drivers).catch(() => ""),
  ]);
  const nameById = new Map(
    (driversCsv ? mapDrivers(parseCsv(driversCsv)) : []).map((d) => [d.driver_id, d.name] as const),
  );

  const races = await Promise.all(
    upcoming.map(async (race) => {
      const records = await listAttendanceForRace(race.raceId);
      const byStatus: Record<AttendanceStatus, string[]> = { going: [], maybe: [], out: [] };
      for (const r of records) {
        byStatus[r.status].push(nameById.get(r.driverId) ?? r.driverId);
      }
      for (const s of ATTENDANCE_STATUSES) byStatus[s].sort((a, b) => a.localeCompare(b));
      return { race, byStatus, responded: records.length };
    }),
  );

  return (
    <main className="text-ink-2">
      <Section title={t("adminTitle")} description={t("adminDescription")} pageHeader>
        <div className="mx-auto max-w-4xl space-y-6">
          <p className="text-sm">
            <LoadingLink href="/admin" className="text-oxblood hover:text-oxblood-deep">
              {t("backToAdmin")}
            </LoadingLink>
          </p>

          {races.length === 0 ? (
            <div className={card}>
              <p className="text-sm text-meta">{t("noRaces")}</p>
            </div>
          ) : (
            races.map(({ race, byStatus, responded }) => {
              const name = locale === "he" ? race.nameHe : race.name;
              const meta = [race.date, race.startTime, race.league].filter(Boolean).join(" · ");
              return (
                <div key={race.raceId} className={card}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className={h2}>
                      {name}
                      {race.raceCount > 1 ? ` (${t("doubleHeader")})` : ""}
                    </h2>
                    <span className="text-xs text-meta">{meta}</span>
                  </div>
                  <p className="mt-1 text-xs text-meta">{t("respondedCount", { count: responded })}</p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-3">
                    {ATTENDANCE_STATUSES.map((status) => (
                      <div key={status}>
                        <div
                          className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.06em]"
                          style={{ color: tone[status] }}
                        >
                          <span>{t(`status.${status}`)}</span>
                          <span className="num text-meta">({byStatus[status].length})</span>
                        </div>
                        {byStatus[status].length === 0 ? (
                          <p className="text-xs text-faint">—</p>
                        ) : (
                          <ul className="space-y-1 text-sm text-ink-2">
                            {byStatus[status].map((driverName) => (
                              <li key={driverName}>{driverName}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Section>
    </main>
  );
}
