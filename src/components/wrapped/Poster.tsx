import { Children, type ReactNode, useState } from "react";
import { useImageUrl } from "@/hooks/useImageUrl";

interface Art {
  id?: string;
  name?: string | null;
}

// The artwork tile: the poster if there is one, otherwise the title's first letter.
function ArtTile({ item }: { item: Art }) {
  const url = useImageUrl(item.id);
  const [failed, setFailed] = useState<string>();
  const letter = (item.name?.trim()[0] ?? "?").toUpperCase();
  return (
    <div className="wp-art">
      {url && url !== failed ? (
        <img src={url} alt="" loading="lazy" onError={() => setFailed(url)} />
      ) : (
        <b aria-hidden="true">{letter}</b>
      )}
    </div>
  );
}

interface PosterProps {
  item: Art;
  /** Short lines under the title: year, rating, play count... */
  meta?: (string | false | null | undefined)[];
  onHide?: () => void;
}

export function Poster({ item, meta = [], onHide }: PosterProps) {
  const name = item.name ?? "Untitled";
  return (
    <figure className="wp-poster">
      {onHide && (
        <button
          type="button"
          className="wp-hide"
          aria-label={`Hide ${name}`}
          onClick={onHide}
        >
          ×
        </button>
      )}
      <ArtTile item={item} />
      <figcaption>
        <span className="wp-poster-title">{name}</span>
        {meta
          .filter((line): line is string => !!line)
          .map((line) => (
            <span key={line} className="wp-poster-meta">
              {line}
            </span>
          ))}
      </figcaption>
    </figure>
  );
}

// A small poster for a row in a list.
export function Thumb({ item }: { item: Art }) {
  return (
    <div className="wp-thumb">
      <ArtTile item={item} />
    </div>
  );
}

export function PosterGrid({
  children,
  size,
}: {
  children: ReactNode;
  /** "big" for a few large posters, "one" for a single one. */
  size?: "big" | "one";
}) {
  const className =
    size === "one"
      ? "wp-grid wp-one"
      : size === "big"
        ? "wp-grid wp-big"
        : "wp-grid";
  return (
    <ul className={className}>
      {Children.map(children, (child) => (
        <li>{child}</li>
      ))}
    </ul>
  );
}
