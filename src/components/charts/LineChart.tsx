import { area, extent, line, max, scaleLinear } from "d3";

type Point = { x: number; y: number };

const W = 600;
const H = 380;
const M = { top: 44, right: 14, bottom: 62, left: 92 };

// A thick line over a flat tint, on a thick baseline.
export function LineChart({
  data,
  xLabel,
  yLabel,
  label,
}: {
  data: Point[];
  xLabel: string;
  yLabel: string;
  /** What the chart shows, for screen readers. */
  label: string;
}) {
  if (!data.length) return null;
  const innerW = W - M.left - M.right;
  const innerH = H - M.top - M.bottom;
  const [x0, x1] = extent(data, (d) => d.x) as [number, number];
  const x = scaleLinear()
    .domain([x0, x1 === x0 ? x0 + 1 : x1])
    .range([0, innerW]);
  const y = scaleLinear()
    .domain([0, max(data, (d) => d.y) || 1])
    .nice()
    .range([innerH, 0]);

  const path = line<Point>()
    .x((d) => x(d.x))
    .y((d) => y(d.y))(data);
  const fill = area<Point>()
    .x((d) => x(d.x))
    .y0(innerH)
    .y1((d) => y(d.y))(data);

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
        {fill && <path d={fill} fill="var(--accent)" opacity={0.3} />}
        {path && (
          <path
            d={path}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={data.length > 60 ? 4 : 9}
            strokeLinejoin="round"
          />
        )}
        <line className="axis" x1={0} x2={innerW} y1={innerH} y2={innerH} />
        {x.ticks(5).map((tick) => (
          <text key={tick} x={x(tick)} y={innerH + 36} textAnchor="middle">
            {tick}
          </text>
        ))}
        <text x={innerW / 2} y={innerH + 62} textAnchor="middle">
          {xLabel}
        </text>
      </g>
    </svg>
  );
}
