import type { CSSProperties, ReactNode } from "react";

// The headline is sized from its longest word so no word ever has to break.
const longestWord = (title: ReactNode): number =>
  typeof title === "string"
    ? Math.max(4, ...title.split(/\s+/).map((word) => word.length))
    : 8;

interface SlideProps {
  title: ReactNode;
  /** A line under the headline. */
  sub?: ReactNode;
  /** A second, quieter line. */
  note?: ReactNode;
  /** Headline and content stack in one column even on a wide screen. */
  single?: boolean;
  children?: ReactNode;
}

// The layout every slide shares: a big headline, then the content. On a wide screen the
// headline stays on the left while the content fills the right.
export function Slide({ title, sub, note, single, children }: SlideProps) {
  return (
    <div className={single ? "wp-slide wp-single" : "wp-slide"}>
      <header className="wp-head">
        <h1
          className="wp-title"
          style={{ "--longest": longestWord(title) } as CSSProperties}
        >
          {title}
        </h1>
        {sub && <p className="wp-sub">{sub}</p>}
        {note && <p className="wp-sub">{note}</p>}
      </header>
      {children && <div className="wp-body">{children}</div>}
    </div>
  );
}

export function Panel({
  title,
  children,
}: {
  title?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="wp-panel">
      {title && <h2>{title}</h2>}
      {children}
    </section>
  );
}
