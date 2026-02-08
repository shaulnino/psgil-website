import Section from "@/components/Section";
import ScheduleList from "@/components/ScheduleList";
import { fetchCsv, parseCsv } from "@/lib/csv";
import { mapRaceEvents, sortRaceEvents } from "@/lib/scheduleData";

/* ------------------------------------------------------------------ */
/*  CSV source — update the URL once the Google Sheet tab is published */
/* ------------------------------------------------------------------ */
const SCHEDULE_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQSNGhBKLMDdmeIOy9wn3ZBS3Kk0-oBmWCMs0ANbg3qDrSsp9PbIXm8qLtTUQKA2HkvoNEpZg9Zf_Ps/pub?gid=2105913561&single=true&output=csv";

export default async function SchedulePage() {
  let events = sortRaceEvents([]);

  try {
    const csv = await fetchCsv(SCHEDULE_CSV_URL);
    const raw = parseCsv<Record<string, string>>(csv);
    events = sortRaceEvents(mapRaceEvents(raw));
  } catch {
    // CSV not available yet — page renders an empty state
    events = [];
  }

  return (
    <main className="bg-[#0B0B0E] text-white">
      <Section
        title="Schedule & Race Results"
        description="Full race calendar and results for every PSGiL season."
      >
        <ScheduleList events={events} />
      </Section>
    </main>
  );
}
