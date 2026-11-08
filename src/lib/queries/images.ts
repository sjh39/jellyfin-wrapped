import { getImageApi } from "@jellyfin/sdk/lib/utils/api";
import { ImageType } from "@jellyfin/sdk/lib/generated-client";
import { getAuthenticatedJellyfinApi } from "../jellyfin-api";
import { getCacheValue, setCacheValue } from "../cache";
import { isServerMode, serverFetch } from "./utils";

// Object URLs only live as long as the page, so they are kept in memory, not storage.
const serverImages = new Map<string, Promise<string>>();

/**
 * Server mode: the backend serves the poster it saved, or asks Jellyfin, or finds one
 * elsewhere (TMDB, TVmaze, Cover Art Archive) for items deleted from Jellyfin. The
 * request carries the user's login, so it is fetched here and handed to <img> as a
 * blob URL. Returns "" when there is no image, so the initial-letter fallback shows.
 */
const getServerImageUrl = (id: string): Promise<string> => {
  const existing = serverImages.get(id);
  if (existing !== undefined) return existing;
  const pending = serverFetch(`/api/image/${id}`)
    .then(async (res) => (res.ok ? URL.createObjectURL(await res.blob()) : ""))
    .catch(() => "");
  serverImages.set(id, pending);
  return pending;
};

export const getImageUrlById = async (id: string): Promise<string> => {
  if (!id) return "";
  if (isServerMode()) return getServerImageUrl(id);

  const cacheKey = `imageUrlCache_${id}`;
  const cachedUrl = getCacheValue(cacheKey);
  if (cachedUrl) {
    return cachedUrl;
  }
  const api = getImageApi(await getAuthenticatedJellyfinApi());
  const url = api.getItemImageUrlById(id, ImageType.Primary, {
    maxWidth: 300,
    width: 300,
    quality: 90,
  });
  setCacheValue(cacheKey, url);
  return url;
};
