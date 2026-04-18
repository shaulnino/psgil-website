"use client";

/* ------------------------------------------------------------------ */
/*  Stats V2 — DNA Radar (8-axis polygon)                              */
/*                                                                     */
/*  Pure SVG, no chart library, supports overlay of multiple drivers.  */
/* ------------------------------------------------------------------ */

import { DNA_AXIS_LABELS, type DnaAxis } from "@/lib/statsV2/dna";

const AXES: DnaAxis[] = [
  "one_lap_pace",
  "race_pace",
  "race_craft",
  "consistency",
  "wet_conditions",
  "tyre_management",
  "reliability",
  "clutch",
];

type Series = {
  label: string;
  color: string;
  values: Record<DnaAxis, number | null>;
};

const SIZE = 360;
const CENTER = SIZE / 2;
const RADIUS = SIZE / 2 - 50;
const RINGS = [25, 50, 75, 100];

function pointFor(axisIndex: number, value: number) {
  const angle = (axisIndex / AXES.length) * Math.PI * 2 - Math.PI / 2;
  const r = (value / 100) * RADIUS;
  return {
    x: CENTER + Math.cos(angle) * r,
    y: CENTER + Math.sin(angle) * r,
  };
}

export default function DnaRadar({ series }: { series: Series[] }) {
  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="w-full max-w-[420px] mx-auto"
      role="img"
      aria-label="Driver DNA radar chart"
    >
      {/* Rings */}
      {RINGS.map((r) => (
        <polygon
          key={r}
          points={AXES.map((_, i) => {
            const p = pointFor(i, r);
            return `${p.x},${p.y}`;
          }).join(" ")}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={1}
        />
      ))}

      {/* Axes */}
      {AXES.map((axis, i) => {
        const end = pointFor(i, 100);
        return (
          <g key={axis}>
            <line
              x1={CENTER}
              y1={CENTER}
              x2={end.x}
              y2={end.y}
              stroke="rgba(255,255,255,0.07)"
              strokeWidth={1}
            />
          </g>
        );
      })}

      {/* Series polygons */}
      {series.map((s) => {
        const points = AXES.map((axis, i) => {
          const v = s.values[axis] ?? 0;
          const p = pointFor(i, v);
          return `${p.x},${p.y}`;
        }).join(" ");
        return (
          <g key={s.label}>
            <polygon
              points={points}
              fill={s.color}
              fillOpacity={0.18}
              stroke={s.color}
              strokeWidth={2}
            />
            {AXES.map((axis, i) => {
              const v = s.values[axis];
              if (v === null) return null;
              const p = pointFor(i, v);
              return (
                <circle
                  key={axis}
                  cx={p.x}
                  cy={p.y}
                  r={3}
                  fill={s.color}
                />
              );
            })}
          </g>
        );
      })}

      {/* Axis labels */}
      {AXES.map((axis, i) => {
        const labelPoint = pointFor(i, 118);
        return (
          <text
            key={axis}
            x={labelPoint.x}
            y={labelPoint.y}
            fill="rgba(255,255,255,0.7)"
            fontSize={10}
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {DNA_AXIS_LABELS[axis]}
          </text>
        );
      })}
    </svg>
  );
}
