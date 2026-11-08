import type { ReactNode } from "react";

export function Rows({ children }: { children: ReactNode }) {
  return <ol className="wp-rows">{children}</ol>;
}

interface RowProps {
  /** Rank, if this is a ranking. */
  n?: number;
  /** A thumbnail. */
  art?: ReactNode;
  title: ReactNode;
  /** Small text on the right. */
  meta?: ReactNode;
}

export function Row({ n, art, title, meta }: RowProps) {
  return (
    <li className="wp-row">
      {n !== undefined && <b className="wp-row-n">{n}</b>}
      {art}
      <span className="wp-row-t">{title}</span>
      {meta && <em className="wp-row-m">{meta}</em>}
    </li>
  );
}
