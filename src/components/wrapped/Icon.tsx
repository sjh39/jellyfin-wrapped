// Small solid icons for the controls. Drawn inline so there is no icon font to load.
const PATHS = {
  previous: "M15 5l-8 7 8 7z",
  next: "M9 5l8 7-8 7z",
  play: "M8 5l11 7-11 7z",
  pause: "M6 5h4v14H6zM14 5h4v14h-4z",
  menu: "M4 6h16v3H4zM4 10.5h16v3H4zM4 15h16v3H4z",
  close:
    "M5.5 3.5L12 10l6.5-6.5 2 2L14 12l6.5 6.5-2 2L12 14l-6.5 6.5-2-2L10 12 3.5 5.5z",
  restart: "M12 5V1L6 6l6 5V7a5 5 0 11-5 5H5a7 7 0 107-7z",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name }: { name: IconName }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={PATHS[name]} />
    </svg>
  );
}
