import { addDays, format } from "date-fns";
import { getEndDate, getStartDate, isServerMode, serverFetch } from "./utils";

// Every user's totals for the whole-server slides: who downloaded, requested and watched
// the most. The backend sends names and numbers only, never what was watched.

export type LeaderboardUser = {
  name: string;
  /** This row is the signed-in viewer. */
  you: boolean;
  downloads: number;
  requests: number;
  movieSeconds: number;
  showSeconds: number;
};

type ServerRow = {
  Name: string;
  You: boolean;
  Downloads: number;
  Requests: number;
  MovieSeconds: number;
  ShowSeconds: number;
};

// Only the backend can see other users, so there is nothing to show without it.
export const listLeaderboard = async (): Promise<LeaderboardUser[]> => {
  if (!isServerMode()) return [];
  const start = format(getStartDate(), "yyyy-MM-dd");
  const end = format(addDays(getEndDate(), 1), "yyyy-MM-dd");
  const res = await serverFetch(`/api/leaderboard?start=${start}&end=${end}`);
  // 404: this server runs without the archive.
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`Leaderboard request failed (${res.status})`);
  const data = (await res.json()) as { Users?: ServerRow[] };
  return (data.Users ?? []).map((u) => ({
    name: u.Name,
    you: u.You,
    downloads: u.Downloads,
    requests: u.Requests,
    movieSeconds: u.MovieSeconds,
    showSeconds: u.ShowSeconds,
  }));
};

/** Users with any of `value`, highest first. */
export const rankBy = (
  users: LeaderboardUser[],
  value: (u: LeaderboardUser) => number
): LeaderboardUser[] =>
  users.filter((u) => value(u) > 0).sort((a, b) => value(b) - value(a));

/** 7_560_000 -> "2,100 hours"; under an hour -> "45 minutes" */
export const hoursLabel = (seconds: number): string => {
  const hours = Math.round(seconds / 3600);
  if (hours >= 1)
    return `${hours.toLocaleString()} ${hours === 1 ? "hour" : "hours"}`;
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
};
