import { arc, pie } from "d3";
import { formatWatchTime } from "@/lib/time-helpers";

type Slice = { name: string; minutes: number };

// The brand colors, outlined so a slice never merges into the slide behind it.
const COLORS = [
  "var(--cobalt)",
  "var(--tomato)",
  "var(--marigold)",
  "var(--mint)",
  "var(--ink)",
  "var(--chalk)",
];
const MAX_SLICES = 5;
const SIZE = 400;

export function PieChart({ data, title }: { data: Slice[]; title: string }) {
  const sorted = [...data]
    .filter((d) => d.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes);
  if (!sorted.length) return null;
  const head = sorted.slice(0, MAX_SLICES);
  const rest = sorted.slice(MAX_SLICES);
  const slices: Slice[] = rest.length
    ? [
        ...head,
        { name: "Other", minutes: rest.reduce((s, d) => s + d.minutes, 0) },
      ]
    : head;

  const radius = SIZE / 2 - 8;
  const arcs = pie<Slice>()
    .value((d) => d.minutes)
    .sort(null)(slices);
  const draw = arc<(typeof arcs)[number]>().innerRadius(0).outerRadius(radius);

  return (
    <div>
      <svg
        className="wp-chart wp-pie"
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label={`${title}: ${slices.map((s) => s.name).join(", ")}`}
      >
        <g transform={`translate(${SIZE / 2},${SIZE / 2})`}>
          {arcs.map((a, i) => (
            <path
              key={a.data.name}
              d={draw(a) ?? undefined}
              fill={COLORS[i % COLORS.length]}
              stroke="var(--fg)"
              strokeWidth={6}
            />
          ))}
        </g>
      </svg>
      <ul className="wp-legend">
        {slices.map((s, i) => (
          <li key={s.name}>
            <i style={{ background: COLORS[i % COLORS.length] }} />
            {s.name}
            <em>{formatWatchTime(s.minutes)}</em>
          </li>
        ))}
      </ul>
    </div>
  );
}
