import type { ReactNode } from "react";

// A big number with its label, the loudest thing on a slide.
export function Stat({ value, label }: { value: ReactNode; label: ReactNode }) {
  return (
    <p className="wp-stat">
      <span className="wp-stat-n">{value}</span>
      <span className="wp-stat-l">{label}</span>
    </p>
  );
}
