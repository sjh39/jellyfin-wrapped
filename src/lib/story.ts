// The order of the slides, the color each one gets, and the small bits of state that
// survive moving between them (which way the viewer was heading, and screening mode).

export type Tone = "tomato" | "marigold" | "cobalt" | "mint" | "ink" | "chalk";

export interface Chapter {
  path: string;
  name: string;
  tone: Tone;
}

// Neighbouring slides never share a color.
export const CHAPTERS: Chapter[] = [
  { path: "/TopTen", name: "Top 10", tone: "cobalt" },
  { path: "/first-watched", name: "First watched", tone: "mint" },
  { path: "/movies", name: "Movies", tone: "tomato" },
  { path: "/shows", name: "TV shows", tone: "marigold" },
  { path: "/audio", name: "Music", tone: "cobalt" },
  { path: "/music-videos", name: "Music videos", tone: "tomato" },
  { path: "/actors", name: "Favorite actors", tone: "mint" },
  { path: "/genres", name: "Genres", tone: "marigold" },
  { path: "/tv", name: "Live TV", tone: "ink" },
  {
    path: "/critically-acclaimed",
    name: "Critically acclaimed",
    tone: "tomato",
  },
  { path: "/oldest-movie", name: "Oldest movie", tone: "cobalt" },
  { path: "/oldest-show", name: "Oldest show", tone: "mint" },
  { path: "/new-this-year", name: "New this year", tone: "marigold" },
  { path: "/holidays", name: "Holidays", tone: "tomato" },
  { path: "/minutes-per-day", name: "Watch time", tone: "marigold" },
  { path: "/show-of-the-month", name: "Show of the month", tone: "cobalt" },
  { path: "/unfinished-shows", name: "Unfinished shows", tone: "tomato" },
  { path: "/device-stats", name: "Devices", tone: "mint" },
  { path: "/punch-card", name: "Activity calendar", tone: "ink" },
  { path: "/credits", name: "About and credits", tone: "chalk" },
];

export const FIRST_CHAPTER = CHAPTERS[0].path;

export const chapterIndex = (pathname: string): number =>
  CHAPTERS.findIndex((c) => c.path === pathname);

export const neighbours = (
  pathname: string
): { next: string | null; previous: string | null } => {
  const i = chapterIndex(pathname);
  if (i < 0) return { next: null, previous: null };
  return {
    next: CHAPTERS[i + 1]?.path ?? null,
    previous: CHAPTERS[i - 1]?.path ?? null,
  };
};

// ---- which way the viewer was heading --------------------------------------------
// A slide with nothing to show passes the viewer along in the direction they were going
// (so stepping through the story never stops on an empty page). Opening a slide from the
// menu does not count: they asked for that one.
export type NavDirection = "next" | "previous" | "jump";
const DIRECTION_KEY = "wrapped_direction";

export const setNavDirection = (direction: NavDirection): void => {
  try {
    sessionStorage.setItem(DIRECTION_KEY, direction);
  } catch {
    // Storage can be unavailable (private mode); skipping then just does not happen.
  }
};

export const peekNavDirection = (): NavDirection => {
  try {
    const value = sessionStorage.getItem(DIRECTION_KEY);
    return value === "next" || value === "previous" ? value : "jump";
  } catch {
    return "jump";
  }
};

export const clearNavDirection = (): void => {
  try {
    sessionStorage.removeItem(DIRECTION_KEY);
  } catch {
    // ignore
  }
};

// ---- screening mode ----------------------------------------------------------------
// For a TV or projector with nobody holding the remote: slides advance by themselves.
export const SCREENING_MS = 12000;
const SCREENING_KEY = "wrapped_screening";

export const getScreening = (): boolean => {
  try {
    return localStorage.getItem(SCREENING_KEY) === "1";
  } catch {
    return false;
  }
};

export const setScreening = (on: boolean): void => {
  try {
    if (on) localStorage.setItem(SCREENING_KEY, "1");
    else localStorage.removeItem(SCREENING_KEY);
  } catch {
    // ignore
  }
};
