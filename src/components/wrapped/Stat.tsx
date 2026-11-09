import type { CSSProperties, ReactNode } from "react";

// A big number with its label, the loudest thing on a slide. The number is sized from
// its length so it always fits its column.
export function Stat({ value, label }: { value: ReactNode; label: ReactNode }) {
  const chars =
    typeof value === "string" || typeof value === "number"
      ? String(value).length
      : 4;
  return (
    <p className="wp-stat" style={{ "--chars": chars } as CSSProperties}>
      <span className="wp-stat-n">{value}</span>
      <span className="wp-stat-l">{label}</span>
    </p>
  );
}
