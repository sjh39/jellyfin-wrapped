import { getUserLibraryApi, getItemsApi } from "@jellyfin/sdk/lib/utils/api";
import { getAuthenticatedJellyfinApi } from "../jellyfin-api";
import { getCacheValue, setCacheValue, getCachedHiddenIds } from "../cache";
import { getCurrentUserId, isServerMode, serverFetch } from "./utils";
import { SimpleItemDto } from "./types";
import { BaseItemDto } from "@jellyfin/sdk/lib/generated-client";

const toSimpleItem = (item: BaseItemDto): SimpleItemDto => ({
  id: item.Id,
  parentId: item.ParentId,
  name: item.Name,
  productionYear: item.ProductionYear,
  communityRating: item.CommunityRating,
  people: item.People,
  date: item.PremiereDate,
  genres: item.Genres,
  genreItems: item.GenreItems,
  durationSeconds: Math.floor((item.RunTimeTicks ?? 0) / 10000000),
});

const ARCHIVE_BATCH = 500;

/**
 * Items Jellyfin no longer has (deleted, or replaced by a new file) still exist in the
 * backend's archive. Only available in server mode; returns nothing otherwise.
 */
const getArchivedItems = async (ids: string[]): Promise<SimpleItemDto[]> => {
  if (ids.length === 0 || !isServerMode()) return [];
  const out: SimpleItemDto[] = [];
  for (let i = 0; i < ids.length; i += ARCHIVE_BATCH) {
    try {
      const res = await serverFetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: ids.slice(i, i + ARCHIVE_BATCH) }),
      });
      if (!res.ok) continue;
      const data = (await res.json()) as { Items?: BaseItemDto[] };
      for (const item of data.Items ?? []) {
        const simple = toSimpleItem(item);
        setCacheValue(`item_${item.Id}`, JSON.stringify(simple));
        out.push(simple);
      }
    } catch {
      console.debug("Archive lookup failed");
    }
  }
  return out;
};

const withArchived = async (
  requested: string[],
  found: SimpleItemDto[]
): Promise<SimpleItemDto[]> => {
  const have = new Set(found.map((i) => i.id));
  const missing = requested.filter((id) => !have.has(id));
  return [...found, ...(await getArchivedItems(missing))];
};

export const getItemDtosByIds = async (
  ids: string[]
): Promise<SimpleItemDto[]> => {
  const hiddenIds = getCachedHiddenIds();
  const authenticatedApi = await getAuthenticatedJellyfinApi();
  const userId = await getCurrentUserId();
  const itemsApi = getUserLibraryApi(authenticatedApi);

  const filteredIds = ids.filter((id: string) => !hiddenIds.includes(id));

  // Check cache first
  const cachedItems: SimpleItemDto[] = [];
  const uncachedIds: string[] = [];

  filteredIds.forEach((itemId) => {
    const cachedItem = getCacheValue(`item_${itemId}`);
    if (cachedItem) {
      cachedItems.push(JSON.parse(cachedItem) as SimpleItemDto);
    } else {
      uncachedIds.push(itemId);
    }
  });

  // Batch fetch uncached items
  if (uncachedIds.length === 0) {
    return cachedItems;
  }

  try {
    const itemsApiInstance = getItemsApi(authenticatedApi);
    const BATCH_SIZE = 100;
    const CONCURRENT_BATCHES = 3;
    const fetchedItems: SimpleItemDto[] = [];

    // Process batches with controlled concurrency
    for (
      let i = 0;
      i < uncachedIds.length;
      i += BATCH_SIZE * CONCURRENT_BATCHES
    ) {
      const batchPromises = [];
      for (
        let j = 0;
        j < CONCURRENT_BATCHES && i + j * BATCH_SIZE < uncachedIds.length;
        j++
      ) {
        const start = i + j * BATCH_SIZE;
        const batch = uncachedIds.slice(start, start + BATCH_SIZE);
        batchPromises.push(
          itemsApiInstance.getItems({
            userId,
            ids: batch,
            fields: ["ParentId", "People", "Genres"],
          })
        );
      }

      const responses = await Promise.all(batchPromises);

      for (const response of responses) {
        const batchItems: SimpleItemDto[] = (
          (response as { data: { Items?: BaseItemDto[] } }).data.Items ?? []
        ).map((item: BaseItemDto) => {
          const ticks = item.RunTimeTicks ?? 0;
          const durationSeconds = Math.floor(ticks / 10000000);

          const simpleItem: SimpleItemDto = {
            id: item.Id,
            parentId: item.ParentId,
            name: item.Name,
            productionYear: item.ProductionYear,
            communityRating: item.CommunityRating,
            people: item.People,
            date: item.PremiereDate,
            genres: item.Genres,
            genreItems: item.GenreItems,
            durationSeconds,
          };

          setCacheValue(`item_${item.Id}`, JSON.stringify(simpleItem));
          return simpleItem;
        });

        fetchedItems.push(...batchItems);
      }
    }

    return [...cachedItems, ...(await withArchived(uncachedIds, fetchedItems))];
  } catch {
    console.debug(`Batch fetch failed, falling back to individual requests`);

    // Fallback to individual requests if batch fails
    const itemPromises = uncachedIds.map(async (itemId: string) => {
      try {
        const item = await itemsApi.getItem({ itemId, userId });
        const ticks = item.data.RunTimeTicks ?? 0;
        const durationSeconds = Math.floor(ticks / 10000000);

        const simpleItem: SimpleItemDto = {
          id: item.data.Id,
          parentId: item.data.ParentId,
          name: item.data.Name,
          productionYear: item.data.ProductionYear,
          communityRating: item.data.CommunityRating,
          people: item.data.People,
          date: item.data.PremiereDate,
          genres: item.data.Genres,
          genreItems: item.data.GenreItems,
          durationSeconds,
        };
        setCacheValue(`item_${itemId}`, JSON.stringify(simpleItem));
        return simpleItem;
      } catch {
        console.debug(`Item ${itemId} not found, skipping`);
        return null;
      }
    });

    const fetchedItems = await Promise.all(itemPromises);
    return [
      ...cachedItems,
      ...(await withArchived(
        uncachedIds,
        fetchedItems.filter((item): item is SimpleItemDto => item !== null)
      )),
    ];
  }
};
