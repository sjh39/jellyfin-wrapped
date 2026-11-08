import { getItemsApi } from "@jellyfin/sdk/lib/utils/api";
import { BaseItemDto } from "@jellyfin/sdk/lib/generated-client";
import { getAuthenticatedJellyfinApi } from "../jellyfin-api";
import { getCachedHiddenIds } from "../cache";
import { addDays, format, isSameDay } from "date-fns";
import {
  getCurrentUserId,
  getStartDate,
  getEndDate,
  isServerMode,
  serverFetch,
} from "./utils";
import { SimpleItemDto } from "./types";

export type NewLibraryItem = {
  kind: "movie" | "show";
  item: SimpleItemDto;
  // When Jellyfin added the item to the library (the item's DateCreated).
  addedAt: Date;
  // No longer on the server (known from the backend's archive, server mode only).
  deleted?: boolean;
};

type ArchivedAddition = BaseItemDto & { Deleted?: boolean };

// Server mode: the backend's archive remembers everything that was ever added,
// including items deleted from Jellyfin since.
const listArchivedNewThisYear = async (
  startDate: Date,
  upperBound: Date
): Promise<NewLibraryItem[]> => {
  const start = format(startDate, "yyyy-MM-dd");
  const end = format(addDays(upperBound, 1), "yyyy-MM-dd");
  const res = await serverFetch(
    `/api/library-additions?start=${start}&end=${end}`
  );
  if (!res.ok) {
    throw new Error(`Library additions request failed (${res.status})`);
  }
  const data = (await res.json()) as { Items?: ArchivedAddition[] };
  const hiddenIds = getCachedHiddenIds();
  return (data.Items ?? [])
    .filter(
      (dto) =>
        (dto.Type === "Movie" || dto.Type === "Series") &&
        dto.Id &&
        dto.DateCreated &&
        !hiddenIds.includes(dto.Id)
    )
    .map((dto) => ({
      kind: dto.Type === "Series" ? ("show" as const) : ("movie" as const),
      item: toSimpleItemDto(dto),
      addedAt: new Date(dto.DateCreated ?? ""),
      deleted: !!dto.Deleted,
    }))
    .sort((a, b) => a.addedAt.getTime() - b.addedAt.getTime());
};

const toSimpleItemDto = (item: BaseItemDto): SimpleItemDto => ({
  id: item.Id,
  parentId: item.ParentId,
  name: item.Name,
  productionYear: item.ProductionYear,
  communityRating: item.CommunityRating,
  date: item.PremiereDate,
  genres: item.Genres,
  genreItems: item.GenreItems,
  durationSeconds: Math.floor((item.RunTimeTicks ?? 0) / 10000000),
});

// Movies and series added to the library in the selected timeframe, oldest first.
// This reads the library itself, not the Playback Reporting plugin, so it also
// lists things that were added but never watched.
export const listNewThisYear = async (): Promise<NewLibraryItem[]> => {
  const api = await getAuthenticatedJellyfinApi();
  const userId = await getCurrentUserId();
  const startDate = getStartDate();
  const endDate = getEndDate();
  // Same allowance as formatEndDateForSql: for timeframes that end now, the
  // server's clock may already be a day ahead of the browser.
  const upperBound = isSameDay(endDate, new Date())
    ? addDays(endDate, 1)
    : endDate;

  if (isServerMode()) return listArchivedNewThisYear(startDate, upperBound);

  const response = await getItemsApi(api).getItems({
    userId,
    includeItemTypes: ["Movie", "Series"],
    recursive: true,
    sortBy: ["DateCreated"],
    sortOrder: ["Ascending"],
    // An item is never saved before it is created, so this only trims the
    // response; the exact DateCreated window is applied below.
    minDateLastSaved: startDate.toISOString(),
    fields: ["DateCreated", "ParentId", "Genres"],
    enableImages: false,
    enableUserData: false,
  });

  const hiddenIds = getCachedHiddenIds();
  const added: NewLibraryItem[] = [];
  for (const dto of response.data.Items ?? []) {
    if (!dto.Id || !dto.DateCreated || hiddenIds.includes(dto.Id)) continue;
    const addedAt = new Date(dto.DateCreated);
    if (addedAt < startDate || addedAt > upperBound) continue;
    added.push({
      kind: dto.Type === "Series" ? "show" : "movie",
      item: toSimpleItemDto(dto),
      addedAt,
    });
  }
  return added.sort((a, b) => a.addedAt.getTime() - b.addedAt.getTime());
};
