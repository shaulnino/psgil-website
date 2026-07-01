import type { Metadata } from "next";
import {
  Circle,
  CircleDot,
  CircleDashed,
  Triangle,
  Stamp,
  Check,
  Square,
  ArrowRight,
  Ban,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Eyebrow } from "@/components/ui/eyebrow";
import { StatTile } from "@/components/ui/stat-tile";
import { StatusBadge } from "@/components/ui/status-badge";

export const metadata: Metadata = {
  title: "ISL Design Preview — Qav Rishon",
  robots: { index: false, follow: false },
};

/* Internal, non-navigable showcase of the ISL "Qav Rishon" primitive library
   rendered in the light editorial theme. NOT linked in the site nav; exists so
   the new design language can be reviewed before the Phase 5 route-by-route
   flip. The live pages remain on the current dark theme. */

const PALETTE: { name: string; token: string; hex: string; text?: boolean }[] = [
  { name: "Bone", token: "bg-bone", hex: "#F4EFE4" },
  { name: "Paper", token: "bg-paper", hex: "#FBF8F0" },
  { name: "Cream", token: "bg-cream", hex: "#EAE2D0" },
  { name: "Sink", token: "bg-sink", hex: "#DED4BF" },
  { name: "Ink", token: "bg-ink", hex: "#1C1712", text: true },
  { name: "Ink-2", token: "bg-ink-2", hex: "#3A322A", text: true },
  { name: "Oxblood", token: "bg-oxblood", hex: "#7E2A1E", text: true },
  { name: "Brass", token: "bg-brass", hex: "#9C7A3C", text: true },
];

function SectionRule({ label }: { label: string }) {
  return (
    <div className="isl-double-rule pt-4">
      <Eyebrow className="pt-3">{label}</Eyebrow>
    </div>
  );
}

export default function DesignPreviewPage() {
  return (
    <main className="min-h-screen bg-bone font-isl-body text-ink-2">
      <div className="mx-auto w-full max-w-[1240px] px-5 py-10">
        {/* ── Masthead ── */}
        <header className="isl-speed-lines rounded-[2px] border border-hairline bg-paper p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex items-baseline gap-4">
              <span className="font-isl-display text-5xl font-extrabold leading-none tracking-[0.005em] text-ink">
                ISL
              </span>
              <span
                dir="rtl"
                lang="he"
                className="text-3xl leading-none text-ink"
                style={{ fontFamily: "var(--font-frank-ruhl), serif", fontWeight: 700 }}
              >
                קו ראשון
              </span>
            </div>
            <div className="text-end">
              <p className="num text-xs text-meta">SEASON 6 · ROUND 08 · GMT+3</p>
              <p className="font-isl-body text-[0.7rem] uppercase tracking-[0.2em] text-brass-ink">
                The Racing Broadsheet
              </p>
            </div>
          </div>
          <p className="mt-4 max-w-2xl font-isl-body text-sm text-meta">
            F1 Israeli Super League — one league, printed in ink. Every lap on the record.
            This page previews the new design language; the live site is unchanged.
          </p>
        </header>

        {/* ── Color ── */}
        <SectionRule label="Colour System" />
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {PALETTE.map((c) => (
            <div key={c.name} className="rounded-[2px] border border-hairline bg-paper p-2">
              <div className={`${c.token} h-14 w-full rounded-[2px] border border-hairline`} />
              <div className="mt-2 flex items-center justify-between">
                <span className="font-isl-body text-xs font-semibold text-ink">{c.name}</span>
                <span className="num text-[0.65rem] text-meta">{c.hex}</span>
              </div>
            </div>
          ))}
        </div>

        {/* ── Typography ── */}
        <SectionRule label="Typography" />
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          <div>
            <p className="text-[0.7rem] uppercase tracking-[0.2em] text-meta">Display · Barlow…er, Zilla Slab 700</p>
            <p className="font-isl-display text-4xl font-bold leading-[1.05] tracking-[0.005em] text-ink">
              Emilia Romagna Grand Prix
            </p>
            <p className="mt-4 text-[0.7rem] uppercase tracking-[0.2em] text-meta">Body · Public Sans</p>
            <p className="mt-1 text-base leading-relaxed text-ink-2">
              A documentary, restrained voice for dense prose and forms — the paper of record,
              not a gaming HUD.
            </p>
          </div>
          <div>
            <p className="text-[0.7rem] uppercase tracking-[0.2em] text-meta">Numerals · Spline Sans Mono (tabular)</p>
            <div className="mt-2 space-y-1">
              {[
                ["P1", "298", "1:31.204"],
                ["P2", "247", "+11.038"],
                ["P3", "205", "+24.771"],
              ].map(([p, pts, gap]) => (
                <div key={p} className="flex items-center gap-6 border-b border-hairline pb-1">
                  <span className="num w-8 text-oxblood">{p}</span>
                  <span className="num w-12 text-ink">{pts}</span>
                  <span className="num text-meta">{gap}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Buttons ── */}
        <SectionRule label="Buttons" />
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button variant="primary">Join ISL</Button>
          <Button variant="secondary">Watch Last Race</Button>
          <Button variant="ghost">Full Schedule</Button>
          <Button variant="primary" size="sm">Small</Button>
          <Button variant="primary" size="lg">Large</Button>
        </div>

        {/* ── Cards ── */}
        <SectionRule label="Cards" />
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <Eyebrow>Race Report</Eyebrow>
              <CardTitle>Miami Grand Prix — Round 07</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-ink-2">
                A clipping: cream fill, one ink hairline, sharp corners, no shadow.
              </p>
            </CardContent>
          </Card>
          <Card stamped>
            <CardHeader>
              <Eyebrow tone="brass">Official Record</Eyebrow>
              <CardTitle>Verdict — Case #042</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-ink-2">
                On-the-record content gets the brass case-stamp frame — permanence, not attention.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* ── Badges & Status ── */}
        <SectionRule label="Badges & Status (shape + label, not hue)" />
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge variant="ink">Main</Badge>
          <Badge variant="oxblood">Live</Badge>
          <Badge variant="brass">Champion</Badge>
          <Badge variant="danger">Penalty</Badge>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <StatusBadge icon={Circle} tone="info">Open</StatusBadge>
          <StatusBadge icon={CircleDot} tone="info">Waiting</StatusBadge>
          <StatusBadge icon={Triangle} tone="warning">Under Review</StatusBadge>
          <StatusBadge icon={Stamp} tone="brass">Verdict Ready</StatusBadge>
          <StatusBadge icon={Check} tone="success">Closed</StatusBadge>
          <StatusBadge icon={Square} tone="muted">Archived</StatusBadge>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <StatusBadge icon={CircleDashed} tone="warning">Awaiting</StatusBadge>
          <StatusBadge icon={Check} tone="success">Served</StatusBadge>
          <StatusBadge icon={Triangle} tone="danger">Not Served</StatusBadge>
          <StatusBadge icon={ArrowRight} tone="bronze">Rolled Forward</StatusBadge>
          <StatusBadge icon={Ban} tone="muted">Cancelled</StatusBadge>
        </div>

        {/* ── Stat tiles ── */}
        <SectionRule label="Stat Tiles" />
        <div className="mt-4 grid grid-cols-2 gap-6 sm:grid-cols-4">
          <StatTile label="Seasons" value="6" />
          <StatTile label="Races" value="98" />
          <StatTile label="Drivers" value="42" />
          <StatTile label="Winners" value="11" sub="unique" />
        </div>

        {/* ── Editorial table ── */}
        <SectionRule label="Standings (editorial table)" />
        <div className="mt-4 overflow-hidden rounded-[2px] border border-hairline bg-paper">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="isl-double-rule bg-sink/40 text-start">
                <th className="px-3 py-2 text-start font-isl-body text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-meta">Pos</th>
                <th className="px-3 py-2 text-start font-isl-body text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-meta">Driver</th>
                <th className="px-3 py-2 text-start font-isl-body text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-meta">Team</th>
                <th className="px-3 py-2 text-end font-isl-body text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-meta">Pts</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["1", "S. Ezra", "Ferrari", "298", true],
                ["2", "G. Cohen", "Red Bull", "247", false],
                ["3", "A. Levi", "McLaren", "205", false],
                ["4", "D. Katz", "Mercedes", "181", false],
                ["5", "N. Bar", "Williams", "150", false],
              ].map(([pos, driver, team, pts, lead], i) => (
                <tr
                  key={pos as string}
                  className={i % 2 === 1 ? "bg-sink/25" : ""}
                >
                  <td
                    className={`px-3 py-2 ${lead ? "border-s-2 border-oxblood" : "border-s-2 border-transparent"}`}
                  >
                    <span className={`num ${lead ? "text-oxblood" : "text-ink"}`}>{pos}</span>
                  </td>
                  <td className="px-3 py-2 text-ink">{driver}</td>
                  <td className="px-3 py-2 text-meta">{team}</td>
                  <td className="px-3 py-2 text-end"><span className="num font-semibold text-ink">{pts}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-10 border-t border-hairline pt-4 font-isl-body text-xs text-meta">
          ISL — F1 Israeli Super League · design preview · not linked in navigation
        </p>
      </div>
    </main>
  );
}
