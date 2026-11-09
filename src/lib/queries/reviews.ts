import { addDays, format } from "date-fns";
import { getCachedHiddenIds } from "../cache";
import { getEndDate, getStartDate, isServerMode, serverFetch } from "./utils";
import { SimpleItemDto } from "./types";

// Star ratings people leave with the Jellyfin Enhanced plugin (1 to 5, in half stars).
// The backend copies them into its archive; each user only ever gets their own.

/** Fewer ratings than this and the rating slides are passed over. */
export const MIN_RATINGS = 3;

export type RatedKind = "movie" | "show" | "season" | "episode";

export type MyRating = {
  rating: number;
  content: string | null;
  ratedAt: Date;
  kind: RatedKind;
  item: SimpleItemDto;
  /** What the poster shows: the show's poster for an episode. */
  art: { id?: string; name?: string | null };
  deleted: boolean;
};

type ArchivedReview = {
  Rating: number | null;
  Content: string | null;
  CreatedAt: string | null;
  UpdatedAt: string | null;
  Item: {
    Id: string;
    Type?: string | null;
    Name?: string | null;
    SeriesId?: string | null;
    SeriesName?: string | null;
    IndexNumber?: number | null;
    ParentIndexNumber?: number | null;
    ProductionYear?: number | null;
    CommunityRating?: number | null;
    RunTimeTicks?: number | null;
    Deleted?: boolean;
  };
};

const KINDS: Record<string, RatedKind> = {
  Movie: "movie",
  Series: "show",
  Season: "season",
  Episode: "episode",
};

const displayName = (item: ArchivedReview["Item"]): string => {
  const show = item.SeriesName ?? "";
  if (item.Type === "Season") return `${show} ${item.Name ?? ""}`.trim();
  if (item.Type === "Episode") {
    return `${show} S${item.ParentIndexNumber ?? 0}E${item.IndexNumber ?? 0}`.trim();
  }
  return item.Name ?? "";
};

// Ratings only exist in server mode: the backend is what reads the plugin.
export const listMyRatings = async (): Promise<MyRating[]> => {
  if (!isServerMode()) return [];
  const start = format(getStartDate(), "yyyy-MM-dd");
  const end = format(addDays(getEndDate(), 1), "yyyy-MM-dd");
  const res = await serverFetch(`/api/reviews?start=${start}&end=${end}`);
  // 404: this server runs without the archive, so there are no ratings to show.
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`Ratings request failed (${res.status})`);
  const data = (await res.json()) as { Reviews?: ArchivedReview[] };
  const hiddenIds = getCachedHiddenIds();
  return (data.Reviews ?? []).flatMap((r): MyRating[] => {
    const kind = r.Item.Type ? KINDS[r.Item.Type] : undefined;
    // A review with text but no stars has nothing to count.
    if (r.Rating === null || !kind || hiddenIds.includes(r.Item.Id)) return [];
    const name = displayName(r.Item);
    return [
      {
        rating: r.Rating,
        content: r.Content,
        ratedAt: new Date(r.UpdatedAt || r.CreatedAt || 0),
        kind,
        item: {
          id: r.Item.Id,
          name,
          productionYear: r.Item.ProductionYear,
          communityRating: r.Item.CommunityRating,
          durationSeconds: Math.floor((r.Item.RunTimeTicks ?? 0) / 10000000),
        },
        art: {
          id:
            r.Item.Type === "Episode"
              ? (r.Item.SeriesId ?? r.Item.Id)
              : r.Item.Id,
          name,
        },
        deleted: !!r.Item.Deleted,
      },
    ];
  });
};

/** 4.5 -> "★★★★½" */
export const stars = (rating: number): string =>
  "★".repeat(Math.floor(rating)) + (rating % 1 ? "½" : "");

export const KIND_LABELS: Record<RatedKind, string> = {
  movie: "Movie",
  show: "Show",
  season: "Season",
  episode: "Episode",
};
