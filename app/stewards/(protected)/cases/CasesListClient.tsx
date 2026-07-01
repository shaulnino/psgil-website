"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fmtDateTime } from "@/app/stewards/lib/dates";
import DeleteCaseForm from "@/app/stewards/(protected)/cases/DeleteCaseForm";

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

export type CaseRow = {
  id: string;
  caseNumber: number | null;
  title: string;
  season: string;
  round: string;
  weekendSession: string;
  status: string;
  createdAt: string;
  href: string;
};

export type StewardCaseRow = CaseRow & {
  needsReview: boolean;
  verdictReady: boolean;
  isAdmin: boolean;
};

type Filters = {
  query: string;
  season: string;
  round: string;
  session: string;
  status: string;
};

const EMPTY_FILTERS: Filters = { query: "", season: "", round: "", session: "", status: "" };

/* ------------------------------------------------------------------ */
/*  Status chip                                                         */
/* ------------------------------------------------------------------ */

const STATUS_CHIP: Record<string, string> = {
  "Open":                 "text-status-info border-status-info",
  "Waiting for Response": "text-status-info border-status-info",
  "Under Review":         "text-status-warning border-status-warning",
  "Verdict Ready":        "text-brass-ink border-brass",
  "Closed":               "text-status-success border-status-success",
  "Archived":             "text-meta border-[color:var(--isl-hairline-strong)]",
};

function StatusChip({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-[2px] border px-2 py-0.5 font-isl-body text-[0.625rem] font-semibold uppercase tracking-[0.12em] leading-none ${STATUS_CHIP[status] ?? STATUS_CHIP["Open"]}`}>
      {status}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Search bar                                                          */
/* ------------------------------------------------------------------ */

function SearchBar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <svg className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-faint" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
      </svg>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Filter by title, case #…"
        className="w-full rounded-[2px] border border-[color:var(--isl-hairline)] bg-paper py-2 ps-9 pe-4 text-sm text-ink placeholder:text-faint focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--isl-oxblood)]"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute end-3 top-1/2 -translate-y-1/2 text-meta hover:text-ink"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Dropdown filter                                                     */
/* ------------------------------------------------------------------ */

function FilterDropdown({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  if (options.length === 0) return null;
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`appearance-none rounded-[2px] border ps-3 pe-7 py-1.5 text-xs transition cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--isl-oxblood)] ${
          value
            ? "border-brass bg-cream text-brass-ink font-semibold"
            : "border-[color:var(--isl-hairline)] bg-paper text-ink-2 hover:border-[color:var(--isl-hairline-strong)]"
        }`}
      >
        <option value="">{label}</option>
        {options.map((o) => (
          <option key={o} value={o} className="bg-paper text-ink">
            {o}
          </option>
        ))}
      </select>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="pointer-events-none absolute end-2 top-1/2 -translate-y-1/2 h-3 w-3 text-meta"
        fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Filter bar (search + dropdowns)                                    */
/* ------------------------------------------------------------------ */

function FilterBar({
  filters,
  onChange,
  allCases,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
  allCases: CaseRow[];
}) {
  const seasons = useMemo(
    () => [...new Set(allCases.map((r) => r.season))].sort().reverse(),
    [allCases],
  );
  const rounds = useMemo(
    () =>
      [
        ...new Set(
          allCases
            .filter((r) => !filters.season || r.season === filters.season)
            .map((r) => r.round),
        ),
      ].sort(),
    [allCases, filters.season],
  );
  const sessions = useMemo(
    () => [...new Set(allCases.map((r) => r.weekendSession))].sort(),
    [allCases],
  );
  const statuses = useMemo(
    () => [...new Set(allCases.map((r) => r.status))],
    [allCases],
  );

  const hasActiveFilters =
    filters.query || filters.season || filters.round || filters.session || filters.status;

  return (
    <div className="space-y-2">
      <SearchBar
        value={filters.query}
        onChange={(v) => onChange({ ...filters, query: v })}
      />
      <div className="flex flex-wrap items-center gap-2">
        <FilterDropdown
          label="Season"
          value={filters.season}
          options={seasons}
          onChange={(v) => onChange({ ...filters, season: v, round: "" })}
        />
        <FilterDropdown
          label="Round"
          value={filters.round}
          options={rounds}
          onChange={(v) => onChange({ ...filters, round: v })}
        />
        <FilterDropdown
          label="Session"
          value={filters.session}
          options={sessions}
          onChange={(v) => onChange({ ...filters, session: v })}
        />
        <FilterDropdown
          label="Status"
          value={filters.status}
          options={statuses}
          onChange={(v) => onChange({ ...filters, status: v })}
        />
        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => onChange(EMPTY_FILTERS)}
            className="rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream px-3 py-1.5 text-xs text-meta hover:border-[color:var(--isl-hairline-strong)] hover:text-ink transition"
          >
            Clear all
          </button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

function matchesFilters(row: CaseRow, filters: Filters) {
  if (filters.season  && row.season         !== filters.season)  return false;
  if (filters.round   && row.round          !== filters.round)   return false;
  if (filters.session && row.weekendSession !== filters.session)  return false;
  if (filters.status  && row.status         !== filters.status)  return false;
  if (filters.query) {
    const lower = filters.query.toLowerCase();
    return (
      row.title.toLowerCase().includes(lower) ||
      row.season.toLowerCase().includes(lower) ||
      row.round.toLowerCase().includes(lower) ||
      row.status.toLowerCase().includes(lower) ||
      String(row.caseNumber ?? "").includes(lower)
    );
  }
  return true;
}

/* ------------------------------------------------------------------ */
/*  Section header with collapse toggle                                 */
/* ------------------------------------------------------------------ */

function SectionHeader({
  title,
  subtitle,
  count,
  open,
  onToggle,
}: {
  title: string;
  subtitle?: string;
  count: number;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center justify-between gap-3 rounded-[2px] px-1 py-1 text-start transition hover:bg-cream"
    >
      <div className="flex items-center gap-2.5">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-3.5 w-3.5 shrink-0 text-meta transition-transform duration-200 rtl:scale-x-[-1] ${open ? "rotate-90" : ""}`}
          fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
        </svg>
        <span className="text-base font-semibold text-ink">{title}</span>
        {subtitle && <span className="text-xs text-meta">{subtitle}</span>}
        <span className="num rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream px-2 py-0.5 text-[11px] font-semibold text-meta">
          {count}
        </span>
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Driver view                                                         */
/* ------------------------------------------------------------------ */

export function DriverCasesList({
  openCases,
  closedCases,
  otherCases,
}: {
  openCases: CaseRow[];
  closedCases: CaseRow[];
  otherCases: CaseRow[];
}) {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    open: true,
    closed: false,
    other: false,
  });

  const allCases = useMemo(
    () => [...openCases, ...closedCases, ...otherCases],
    [openCases, closedCases, otherCases],
  );

  const toggle = (key: string) =>
    setOpenSections((s) => ({ ...s, [key]: !s[key] }));

  const filteredOpen   = useMemo(() => openCases.filter((r)   => matchesFilters(r, filters)), [openCases,   filters]);
  const filteredClosed = useMemo(() => closedCases.filter((r) => matchesFilters(r, filters)), [closedCases, filters]);
  const filteredOther  = useMemo(() => otherCases.filter((r)  => matchesFilters(r, filters)), [otherCases,  filters]);

  const hasFilters = !!(filters.query || filters.season || filters.round || filters.session || filters.status);
  const totalFiltered = filteredOpen.length + filteredClosed.length + filteredOther.length;

  return (
    <div className="space-y-4">
      <FilterBar filters={filters} onChange={setFilters} allCases={allCases} />

      {hasFilters && (
        <p className="text-xs text-meta">
          {totalFiltered === 0 ? "No cases match your filter." : `${totalFiltered} case${totalFiltered !== 1 ? "s" : ""} match`}
        </p>
      )}

      {/* My Open Cases */}
      <div className="space-y-2">
        <SectionHeader
          title="My Open Cases"
          count={filteredOpen.length}
          open={openSections.open || hasFilters}
          onToggle={() => toggle("open")}
        />
        {(openSections.open || hasFilters) && (
          <div className="space-y-2 ps-1">
            {filteredOpen.length === 0 ? (
              <div className="steward-soft rounded-[2px] px-4 py-3 text-sm text-ink-2">
                {hasFilters ? "No open cases match." : "No open cases currently involve you."}
              </div>
            ) : (
              filteredOpen.map((row) => (
                <CaseCard key={row.id} row={row} dim={false} arrow="Open →" />
              ))
            )}
          </div>
        )}
      </div>

      {/* My Closed Cases */}
      <div className="border-t border-[color:var(--isl-hairline)] pt-3 space-y-2">
        <SectionHeader
          title="My Closed Cases"
          count={filteredClosed.length}
          open={openSections.closed || hasFilters}
          onToggle={() => toggle("closed")}
        />
        {(openSections.closed || hasFilters) && (
          <div className="space-y-2 ps-1">
            {filteredClosed.length === 0 ? (
              <div className="steward-soft rounded-[2px] px-4 py-3 text-sm text-ink-2">
                {hasFilters ? "No closed cases match." : "No closed cases found."}
              </div>
            ) : (
              filteredClosed.map((row) => (
                <CaseCard key={row.id} row={row} dim arrow="Open →" />
              ))
            )}
          </div>
        )}
      </div>

      {/* All Cases */}
      {(otherCases.length > 0 || hasFilters) && (
        <div className="border-t border-[color:var(--isl-hairline)] pt-3 space-y-2">
          <SectionHeader
            title="All Cases"
            subtitle="Cases you are not directly involved in"
            count={filteredOther.length}
            open={openSections.other || hasFilters}
            onToggle={() => toggle("other")}
          />
          {(openSections.other || hasFilters) && (
            <div className="space-y-2 ps-1">
              {filteredOther.length === 0 ? (
                <div className="steward-soft rounded-[2px] px-4 py-3 text-sm text-ink-2">
                  {hasFilters ? "No other cases match." : "No other cases."}
                </div>
              ) : (
                filteredOther.map((row) => (
                  <CaseCard key={row.id} row={row} dim opacity arrow="View →" />
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CaseCard({
  row,
  dim = false,
  opacity = false,
  arrow,
}: {
  row: CaseRow;
  dim?: boolean;
  opacity?: boolean;
  arrow: string;
}) {
  return (
    <Link
      href={row.href}
      className={`steward-soft group flex items-center justify-between gap-3 rounded-[2px] px-4 py-3 transition hover:border-brass ${opacity ? "opacity-80 hover:opacity-100" : ""}`}
    >
      <div className="min-w-0">
        <p className={`font-semibold truncate ${dim ? "text-ink-2 group-hover:text-ink" : "text-ink"}`}>
          <span className={`num me-2 ${dim ? "text-brass-ink" : "text-brass-ink"}`}>
            #{row.caseNumber ?? "–"}
          </span>
          {row.title}
        </p>
        <p className="mt-0.5 text-xs text-meta truncate">
          {row.season} · {row.round} · {row.weekendSession}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <StatusChip status={row.status} />
        <span className={`text-xs ${dim ? "text-meta group-hover:text-ink-2" : "text-brass-ink group-hover:text-oxblood-deep"}`}>
          {arrow}
        </span>
      </div>
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/*  Steward table view                                                  */
/* ------------------------------------------------------------------ */

export function StewardCasesTable({
  cases,
  isAdmin,
}: {
  cases: StewardCaseRow[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);

  const filtered = useMemo(
    () => cases.filter((r) => matchesFilters(r, filters)),
    [cases, filters],
  );

  const hasFilters = !!(filters.query || filters.season || filters.round || filters.session || filters.status);

  return (
    <div className="space-y-3">
      <div className="px-5 pt-5">
        <FilterBar filters={filters} onChange={setFilters} allCases={cases} />
        {hasFilters && (
          <p className="mt-2 text-xs text-meta">
            {filtered.length === 0
              ? "No cases match."
              : `${filtered.length} of ${cases.length} case${cases.length !== 1 ? "s" : ""}`}
          </p>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="steward-table min-w-full text-start text-sm">
          <thead className="bg-cream text-ink">
            <tr>
              <th className="px-4 py-3 w-12 text-center">#</th>
              <th className="px-4 py-3">Case</th>
              <th className="px-4 py-3">Season</th>
              <th className="px-4 py-3">Round</th>
              <th className="px-4 py-3">Session</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Created</th>
              {isAdmin && <th className="px-4 py-3">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => {
              const rowCls = item.needsReview
                ? "border-t border-[color:var(--isl-hairline)] border-s-2 border-s-status-warning bg-cream"
                : item.verdictReady
                  ? "border-t border-[color:var(--isl-hairline)] border-s-2 border-s-brass bg-cream"
                  : "border-t border-[color:var(--isl-hairline)]";
              return (
                <tr
                  key={item.id}
                  className={`${rowCls} cursor-pointer hover:bg-cream transition-colors`}
                  onClick={() => router.push(item.href)}
                >
                  <td className="num px-4 py-3 text-center text-sm text-brass-ink w-12">
                    {item.caseNumber ?? "–"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-ink">{item.title}</span>
                      {item.needsReview && (
                        <span className="inline-flex items-center gap-1 rounded-[2px] border border-status-warning px-2 py-0.5 font-isl-body text-[9px] font-semibold uppercase tracking-[0.12em] text-status-warning">
                          <span className="inline-flex h-1.5 w-1.5 rounded-full bg-[color:var(--isl-warning)] animate-[f1-tick_1s_step-end_infinite]" />
                          Review Now
                        </span>
                      )}
                      {item.verdictReady && (
                        <span className="inline-flex items-center gap-1 rounded-[2px] border border-brass px-2 py-0.5 font-isl-body text-[9px] font-semibold uppercase tracking-[0.12em] text-brass-ink">
                          <span className="inline-flex h-1.5 w-1.5 rounded-full bg-[color:var(--isl-brass)] animate-[f1-tick_1s_step-end_infinite]" />
                          Publish Verdict
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">{item.season}</td>
                  <td className="num px-4 py-3">{item.round}</td>
                  <td className="px-4 py-3">{item.weekendSession}</td>
                  <td className="px-4 py-3"><StatusChip status={item.status} /></td>
                  <td className="num px-4 py-3">{fmtDateTime(item.createdAt)}</td>
                  {isAdmin && (
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <DeleteCaseForm
                        caseId={item.id}
                        redirectTo="/stewards/cases?view=steward"
                        className="rounded-[2px] border border-status-danger px-3 py-1.5 text-xs text-status-danger hover:bg-cream"
                      />
                    </td>
                  )}
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td className="px-4 py-5 text-meta" colSpan={isAdmin ? 8 : 7}>
                  {hasFilters ? "No cases match your filter." : "No cases yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
