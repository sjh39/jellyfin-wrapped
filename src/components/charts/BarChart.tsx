import { max, scaleBand, scaleLinear } from "d3";

type BarChartData = { label: string; value: number };

const W = 600;
const H = 380;
const M = { top: 44, right: 8, bottom: 58, left: 92 };

// Flat bars on a thick baseline. The tallest bar takes the second color.
export function BarChart({
  data,
  yLabel,
  label,
}: {
  data: BarChartData[];
  yLabel: string;
  /** What the chart shows, for screen readers. */
  label: string;
}) {
  if (!data.length) return null;
  const innerW = W - M.left - M.right;
  const innerH = H - M.top - M.bottom;
  const x = scaleBand()
    .domain(data.map((d) => d.label))
    .range([0, innerW])
    .padding(0.16);
  const top = max(data, (d) => d.value) ?? 0;
  const y = scaleLinear()
    .domain([0, top || 1])
    .nice()
    .range([innerH, 0]);
  const tallest = data.findIndex((d) => d.value === top);

  return (
    <svg
      className="wp-chart"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={label}
    >
      <text x={0} y={26}>
        {yLabel}
      </text>
      <g transform={`translate(${M.left},${M.top})`}>
        {y.ticks(3).map((tick) => (
          <g key={tick}>
            <line
              className="grid"
              x1={0}
              x2={innerW}
              y1={y(tick)}
              y2={y(tick)}
            />
            <text
              x={-14}
              y={y(tick)}
              textAnchor="end"
              dominantBaseline="middle"
            >
              {tick.toLocaleString()}
            </text>
          </g>
        ))}
        {data.map((d, i) => (
          <rect
            key={d.label}
            x={x(d.label)}
            y={y(d.value)}
            width={x.bandwidth()}
            height={innerH - y(d.value)}
            fill={i === tallest ? "var(--accent2)" : "var(--accent)"}
          />
        ))}
        <line className="axis" x1={0} x2={innerW} y1={innerH} y2={innerH} />
        {data.map((d) => (
          <text
            key={d.label}
            x={(x(d.label) ?? 0) + x.bandwidth() / 2}
            y={innerH + 38}
            textAnchor="middle"
          >
            {d.label}
          </text>
        ))}
      </g>
    </svg>
  );
}
