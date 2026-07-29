import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Section from "@/components/Section";
import LoadingLink from "@/components/LoadingLink";
import { Badge } from "@/components/ui/badge";
import { requireAttendanceAdmin } from "@/lib/auth/session";
import { can } from "@/lib/stewards/auth";
import { fetchCsv, parseCsv } from "@/lib/csv";
import { localizedDriverName, mapDrivers } from "@/lib/driversData";
import { GLOBAL_CSV_URLS } from "@/lib/seasonConfig";
import { fetchNextRaceWindow } from "@/lib/attendance/races";
import { listAttendanceForRace } from "@/lib/attendance/repository";
import { formatIsraelDateTime } from "@/lib/attendance/format";
import { ATTENDANCE_STATUSES, type AttendanceRecord, type AttendanceStatus } from "@/lib/attendance/types";
import AttendanceAdminControls from "./AttendanceAdminControls";

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
  const user = await requireAttendanceAdmin("/admin/attendance");
  const isFullAdmin = can(user, "manage_users");
  const { locale } = await params;
  const t = await getTranslations("attendance");

  const [raceWindow, driversCsv] = await Promise.all([
    fetchNextRaceWindow(),
    fetchCsv(GLOBAL_CSV_URLS.drivers).catch(() => ""),
  ]);

  const backLink = (
    <p className="text-sm">
      <LoadingLink
        href={isFullAdmin ? "/admin" : "/account"}
        className="text-oxblood hover:text-oxblood-deep"
      >
        {isFullAdmin ? t("backToAdmin") : t("backToAccount")}
      </LoadingLink>
    </p>
  );

  if (!raceWindow.race) {
    return (
      <main className="text-ink-2">
        <Section title={t("adminTitle")} description={t("adminDescription")} pageHeader>
          <div className="mx-auto max-w-4xl space-y-6">
            {backLink}
            <div className={card}>
              <p className="text-sm text-meta">{t("noRaces")}</p>
            </div>
          </div>
        </Section>
      </main>
    );
  }

  const race = raceWindow.race;
  // Only include drivers explicitly marked Main or Reserve in the CSV. Blank /
  // other roles are coerced to "main" by normalizeRole(), so we key off the raw
  // CSV role here to keep inactive/unassigned drivers out of the attendance list.
  const rawDriverRows = driversCsv ? parseCsv(driversCsv) : [];
  const rosterIds = new Set(
    rawDriverRows
      .filter((r) => {
        const role = (r.role ?? "").toLowerCase().trim();
        return role === "main" || role === "reserve";
      })
      .map((r) => (r.driver_id ?? "").trim()),
  );
  const drivers = mapDrivers(rawDriverRows)
    .filter((d) => rosterIds.has(d.driver_id))
    .sort((a, b) => localizedDriverName(a, locale).localeCompare(localizedDriverName(b, locale)));

  const records = await listAttendanceForRace(race.raceId);
  const byDriver = new Map<string, AttendanceRecord>(records.map((r) => [r.driverId, r]));

  const counts: Record<AttendanceStatus, number> = { going: 0, maybe: 0, out: 0 };
  for (const r of records) counts[r.status] += 1;

  const name = locale === "he" ? race.nameHe : race.name;
  const meta = [race.date, race.startTime, race.league].filter(Boolean).join(" · ");

  const windowNote =
    raceWindow.state === "before" && raceWindow.opensTs != null
      ? t("windowOpensAt", { when: formatIsraelDateTime(raceWindow.opensTs, locale) })
      : raceWindow.state === "closed"
        ? t("windowClosed")
        : raceWindow.state === "open" && raceWindow.closesTs != null
          ? t("windowOpenUntil", { when: formatIsraelDateTime(raceWindow.closesTs, locale) })
          : null;

  return (
    <main className="text-ink-2">
      <Section title={t("adminTitle")} description={t("adminDescription")} pageHeader>
        <div className="mx-auto max-w-4xl space-y-6">
          {backLink}

          <div className={card}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className={h2}>
                {name}
                {race.raceCount > 1 ? ` (${t("doubleHeader")})` : ""}
              </h2>
              <span className="text-xs text-meta">{meta}</span>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              {ATTENDANCE_STATUSES.map((status) => (
                <span key={status} style={{ color: tone[status] }} className="font-bold uppercase tracking-[0.06em]">
                  {t(`status.${status}`)} <span className="num">({counts[status]})</span>
                </span>
              ))}
              <span className="text-meta">{t("respondedCount", { count: records.length })}</span>
            </div>
            {windowNote && <p className="mt-2 text-xs text-meta">{windowNote}</p>}
            <p className="mt-1 text-xs text-faint">{t("adminEditHint")}</p>

            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-start text-sm">
                <thead className="text-meta">
                  <tr>
                    <th className="py-2 pe-3 text-start">{t("colDriver")}</th>
                    <th className="py-2 pe-3 text-start">{t("colResponse")}</th>
                    <th className="py-2 text-start">{t("colUpdated")}</th>
                  </tr>
                </thead>
                <tbody>
                  {drivers.map((d) => {
                    const rec = byDriver.get(d.driver_id) ?? null;
                    const updatedLabel = rec
                      ? `${formatIsraelDateTime(Date.parse(rec.updatedAt), locale)} · ${
                          rec.setBy === "admin" ? t("byAdmin") : t("byDriver")
                        }`
                      : "—";
                    return (
                      <tr key={d.driver_id} className="border-t border-[color:var(--isl-hairline)] align-top">
                        <td className="py-2.5 pe-3 text-ink">
                          <span className="flex flex-wrap items-center gap-2">
                            <span>{localizedDriverName(d, locale)}</span>
                            <Badge variant={d.role === "reserve" ? "ink" : "brass"}>
                              {d.role === "reserve" ? t("roleReserve") : t("roleMain")}
                            </Badge>
                          </span>
                        </td>
                        <td className="py-2.5 pe-3">
                          <AttendanceAdminControls
                            raceId={race.raceId}
                            driverId={d.driver_id}
                            currentStatus={rec?.status ?? null}
                          />
                        </td>
                        <td className="py-2.5 text-xs text-meta">{updatedLabel}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Section>
    </main>
  );
}
