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
  "Open":                 "bg-amber-400/20 text-amber-200 border-amber-400/50",
  "Waiting for Response": "bg-blue-400/20  text-blue-200  border-blue-400/50",
  "Under Review":         "bg-purple-400/20 text-purple-200 border-purple-400/50",
  "Verdict Ready":        "bg-emerald-400/20 text-emerald-200 border-emerald-400/50",
  "Closed":               "bg-green-500/20 text-green-200 border-green-500/50",
  "Archived":             "bg-white/10 text-white/50 border-white/20",
};

function StatusChip({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STATUS_CHIP[status] ?? STATUS_CHIP["Open"]}`}>
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
      <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
      </svg>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Filter by title, case #…"
        className="w-full rounded-xl border border-white/10 bg-black/30 py-2 pl-9 pr-4 text-sm text-white placeholder:text-white/30 focus:border-steward-gold/40 focus:outline-none"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70"
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
        className={`appearance-none rounded-lg border px-3 py-1.5 pr-7 text-xs focus:outline-none focus:border-steward-gold/40 transition cursor-pointer ${
          value
            ? "border-steward-gold/50 bg-steward-gold/10 text-steward-gold font-semibold"
            : "border-white/10 bg-black/30 text-white/60 hover:border-white/20"
        }`}
      >
        <option value="">{label}</option>
        {options.map((o) => (
          <option key={o} value={o} className="bg-[#1a1a2e] text-white">
            {o}
          </option>
        ))}
      </select>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-white/30"
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
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/50 hover:border-white/20 hover:text-white/80 transition"
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
      className="flex w-full items-center justify-between gap-3 rounded-lg px-1 py-1 text-left transition hover:bg-white/5"
    >
      <div className="flex items-center gap-2.5">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-3.5 w-3.5 shrink-0 text-white/40 transition-transform duration-200 ${open ? "rotate-90" : ""}`}
          fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
        </svg>
        <span className="text-base font-semibold text-white/90">{title}</span>
        {subtitle && <span className="text-xs text-white/40">{subtitle}</span>}
        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-white/50">
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
        <p className="text-xs text-white/40">
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
          <div className="space-y-2 pl-1">
            {filteredOpen.length === 0 ? (
              <div className="steward-soft rounded-lg px-4 py-3 text-sm text-white/50">
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
      <div className="border-t border-white/10 pt-3 space-y-2">
        <SectionHeader
          title="My Closed Cases"
          count={filteredClosed.length}
          open={openSections.closed || hasFilters}
          onToggle={() => toggle("closed")}
        />
        {(openSections.closed || hasFilters) && (
          <div className="space-y-2 pl-1">
            {filteredClosed.length === 0 ? (
              <div className="steward-soft rounded-lg px-4 py-3 text-sm text-white/50">
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
        <div className="border-t border-white/10 pt-3 space-y-2">
          <SectionHeader
            title="All Cases"
            subtitle="Cases you are not directly involved in"
            count={filteredOther.length}
            open={openSections.other || hasFilters}
            onToggle={() => toggle("other")}
          />
          {(openSections.other || hasFilters) && (
            <div className="space-y-2 pl-1">
              {filteredOther.length === 0 ? (
                <div className="steward-soft rounded-lg px-4 py-3 text-sm text-white/50">
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
      className={`steward-soft group flex items-center justify-between gap-3 rounded-xl px-4 py-3 transition hover:border-steward-gold/50 ${opacity ? "opacity-80 hover:opacity-100" : ""}`}
    >
      <div className="min-w-0">
        <p className={`font-semibold truncate ${dim ? "text-white/70 group-hover:text-white/90" : "text-white/90 group-hover:text-white"}`}>
          <span className={`mr-2 font-mono ${dim ? "text-steward-gold/50" : "text-steward-gold/70"}`}>
            #{row.caseNumber ?? "–"}
          </span>
          {row.title}
        </p>
        <p className="mt-0.5 text-xs text-white/40 truncate">
          {row.season} · {row.round} · {row.weekendSession}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <StatusChip status={row.status} />
        <span className={`text-xs ${dim ? "text-white/30 group-hover:text-white/60" : "text-steward-gold/70 group-hover:text-steward-gold"}`}>
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
          <p className="mt-2 text-xs text-white/40">
            {filtered.length === 0
              ? "No cases match."
              : `${filtered.length} of ${cases.length} case${cases.length !== 1 ? "s" : ""}`}
          </p>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="steward-table min-w-full text-left text-sm">
          <thead className="bg-white/5 text-white/80">
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
                ? "border-t border-purple-500/40 bg-purple-500/10"
                : item.verdictReady
                  ? "border-t border-emerald-500/30 bg-emerald-500/8"
                  : "border-t border-white/10";
              return (
                <tr
                  key={item.id}
                  className={`${rowCls} cursor-pointer hover:bg-white/5 transition-colors`}
                  onClick={() => router.push(item.href)}
                >
                  <td className="px-4 py-3 text-center font-mono text-sm text-steward-gold/60 w-12">
                    {item.caseNumber ?? "–"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[#d4afff]">{item.title}</span>
                      {item.needsReview && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/25 border border-purple-400/60 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-purple-200">
                          <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-purple-300 opacity-70" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-purple-300" /></span>
                          Review Now
                        </span>
                      )}
                      {item.verdictReady && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-400/50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-emerald-200">
                          <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-70" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-300" /></span>
                          Publish Verdict
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">{item.season}</td>
                  <td className="px-4 py-3">{item.round}</td>
                  <td className="px-4 py-3">{item.weekendSession}</td>
                  <td className="px-4 py-3"><StatusChip status={item.status} /></td>
                  <td className="px-4 py-3">{fmtDateTime(item.createdAt)}</td>
                  {isAdmin && (
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <DeleteCaseForm
                        caseId={item.id}
                        redirectTo="/stewards/cases?view=steward"
                        className="rounded-full border border-red-500/50 px-3 py-1.5 text-xs text-red-200 hover:bg-red-500/15"
                      />
                    </td>
                  )}
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td className="px-4 py-5 text-white/60" colSpan={isAdmin ? 8 : 7}>
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
