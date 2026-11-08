// Finds a poster for any item Wrapped shows, including items deleted from Jellyfin.
//
// Order: the copy saved on disk -> Jellyfin itself (and save it) -> outside sources:
//   TMDB (movies, shows, seasons, people; needs TMDB_API_KEY)
//   TVmaze (shows; no key)
//   Cover Art Archive (albums and tracks with MusicBrainz ids; no key)
// Lookups that find nothing are remembered for a week so they are not repeated on
// every page load.
import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { Archive, ArchivedItem } from "./archive.js";
import { fetchImageBytes, type FetchedImage, type JellyfinClient } from "./jellyfin.js";
import { logEvent } from "./limits.js";

const RETRY_MISSING_MS = 7 * 24 * 60 * 60 * 1000;
const LOOKUP_TIMEOUT_MS = 15000;
const TMDB_IMAGE = "https://image.tmdb.org/t/p/w342";
const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

export interface ServedImage {
  bytes: Buffer;
  contentType: string;
}

export class ImageStore {
  private readonly dir: string;
  private readonly inflight = new Map<string, Promise<ServedImage | null>>();

  constructor(
    private readonly archive: Archive,
    private readonly jellyfin: JellyfinClient,
    archiveDir: string,
    private readonly tmdbKey: string | undefined,
    private readonly fetchImpl: typeof fetch = fetch
  ) {
    this.dir = join(archiveDir, "images");
    mkdirSync(this.dir, { recursive: true });
  }

  /** Get the image for an id, finding and saving it if needed. One lookup per id at a time. */
  get(id: string): Promise<ServedImage | null> {
    const running = this.inflight.get(id);
    if (running) return running;
    const promise = this.resolve(id).finally(() => this.inflight.delete(id));
    this.inflight.set(id, promise);
    return promise;
  }

  /** Save Jellyfin's copy now, while the item still exists. Used by the background sync. */
  async saveFromJellyfin(id: string): Promise<boolean> {
    const image = await this.jellyfin.fetchPrimaryImage(id);
    if (image) {
      this.save(id, image, "jellyfin");
      return true;
    }
    // Jellyfin has no poster for it; outside sources are tried only when someone asks.
    this.archive.setImage(id, {
      file: null,
      contentType: null,
      source: "jellyfin-none",
      fetchedAt: new Date().toISOString(),
      missing: true,
    });
    return false;
  }

  private async resolve(id: string): Promise<ServedImage | null> {
    const record = this.archive.getImage(id);
    if (record?.file) {
      const path = join(this.dir, record.file);
      if (existsSync(path)) {
        return { bytes: readFileSync(path), contentType: record.contentType ?? "image/jpeg" };
      }
    }
    if (
      record?.missing &&
      record.source !== "jellyfin-none" &&
      Date.now() - Date.parse(record.fetchedAt) < RETRY_MISSING_MS
    ) {
      return null;
    }

    const live = await this.jellyfin.fetchPrimaryImage(id);
    if (live) return this.save(id, live, "jellyfin");

    const found = await this.findElsewhere(id);
    if (found) return this.save(id, found.image, found.source);

    this.archive.setImage(id, {
      file: null,
      contentType: null,
      source: "none",
      fetchedAt: new Date().toISOString(),
      missing: true,
    });
    return null;
  }

  private save(id: string, image: FetchedImage, source: string): ServedImage {
    const file = `${id}.${EXTENSIONS[image.contentType] ?? "img"}`;
    const tmp = join(this.dir, `.${file}.tmp`);
    writeFileSync(tmp, image.bytes);
    renameSync(tmp, join(this.dir, file));
    this.archive.setImage(id, {
      file,
      contentType: image.contentType,
      source,
      fetchedAt: new Date().toISOString(),
      missing: false,
    });
    if (source !== "jellyfin") logEvent("image_found_elsewhere", { id, source });
    return { bytes: image.bytes, contentType: image.contentType };
  }

  // ---- outside sources ---------------------------------------------------

  private async findElsewhere(
    id: string
  ): Promise<{ image: FetchedImage; source: string } | null> {
    const item = this.archive.getItem(id);
    if (!item) {
      const person = this.archive.personName(id);
      if (!person) return null;
      return this.tmdbPerson(person);
    }

    switch (item.Type) {
      case "Movie":
      case "Video":
      case "MusicVideo":
        return this.tmdbMovie(item);
      case "Series":
        return (await this.tmdbShow(item)) ?? (await this.tvmazeShow(item));
      case "Season":
      case "Episode": {
        const seriesId = item.SeriesId ?? (item.Type === "Season" ? item.ParentId : null);
        const series = seriesId ? this.archive.getItem(seriesId) : null;
        if (item.Type === "Season" && series) {
          const season = await this.tmdbSeason(series, item.IndexNumber ?? null);
          if (season) return season;
        }
        // Episodes and seasons without their own art use the show's poster.
        if (seriesId && seriesId !== id) {
          const show = await this.get(seriesId);
          if (show) return { image: show, source: "series" };
        }
        if (series) return (await this.tmdbShow(series)) ?? (await this.tvmazeShow(series));
        return null;
      }
      case "MusicAlbum":
      case "Audio":
        return this.coverArt(item);
      default:
        return null;
    }
  }

  private async json<T>(url: string, headers: Record<string, string> = {}): Promise<T | null> {
    try {
      const res = await this.fetchImpl(url, {
        headers: { accept: "application/json", ...headers },
        signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
      });
      if (!res.ok) return null;
      return (await res.json()) as T;
    } catch {
      return null;
    }
  }

  /** TMDB accepts either a v3 key (query string) or a v4 read token (bearer header). */
  private tmdb<T>(path: string, params: Record<string, string> = {}): Promise<T | null> {
    if (!this.tmdbKey) return Promise.resolve(null);
    const url = new URL(`https://api.themoviedb.org/3${path}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const headers: Record<string, string> = {};
    if (this.tmdbKey.startsWith("eyJ")) headers.Authorization = `Bearer ${this.tmdbKey}`;
    else url.searchParams.set("api_key", this.tmdbKey);
    return this.json<T>(url.toString(), headers);
  }

  private async tmdbPoster(
    path: string | null | undefined,
    source: string
  ): Promise<{ image: FetchedImage; source: string } | null> {
    if (!path || !/^\/[A-Za-z0-9._-]+$/.test(path)) return null;
    const image = await fetchImageBytes(this.fetchImpl, `${TMDB_IMAGE}${path}`);
    return image ? { image, source } : null;
  }

  private async tmdbMovie(item: ArchivedItem) {
    const ids = item.ProviderIds ?? {};
    type Movie = { poster_path?: string | null };
    if (ids.Tmdb && /^\d+$/.test(ids.Tmdb)) {
      const m = await this.tmdb<Movie>(`/movie/${ids.Tmdb}`);
      const hit = await this.tmdbPoster(m?.poster_path, "tmdb");
      if (hit) return hit;
    }
    if (ids.Imdb && /^tt\d+$/.test(ids.Imdb)) {
      const f = await this.tmdb<{ movie_results?: Movie[] }>(`/find/${ids.Imdb}`, {
        external_source: "imdb_id",
      });
      const hit = await this.tmdbPoster(f?.movie_results?.[0]?.poster_path, "tmdb");
      if (hit) return hit;
    }
    if (!item.Name) return null;
    const params: Record<string, string> = { query: item.Name };
    if (item.ProductionYear) params.year = String(item.ProductionYear);
    const s = await this.tmdb<{ results?: Movie[] }>("/search/movie", params);
    return this.tmdbPoster(s?.results?.[0]?.poster_path, "tmdb-search");
  }

  private async tmdbShowId(item: ArchivedItem): Promise<number | null> {
    const ids = item.ProviderIds ?? {};
    if (ids.Tmdb && /^\d+$/.test(ids.Tmdb)) return Number(ids.Tmdb);
    for (const [key, source] of [
      ["Tvdb", "tvdb_id"],
      ["Imdb", "imdb_id"],
    ] as const) {
      const value = ids[key];
      if (!value || !/^(tt)?\d+$/.test(value)) continue;
      const f = await this.tmdb<{ tv_results?: { id: number }[] }>(`/find/${value}`, {
        external_source: source,
      });
      const found = f?.tv_results?.[0]?.id;
      if (found) return found;
    }
    if (!item.Name) return null;
    const params: Record<string, string> = { query: item.Name };
    if (item.ProductionYear) params.first_air_date_year = String(item.ProductionYear);
    const s = await this.tmdb<{ results?: { id: number }[] }>("/search/tv", params);
    return s?.results?.[0]?.id ?? null;
  }

  private async tmdbShow(item: ArchivedItem) {
    const showId = await this.tmdbShowId(item);
    if (!showId) return null;
    const show = await this.tmdb<{ poster_path?: string | null }>(`/tv/${showId}`);
    return this.tmdbPoster(show?.poster_path, "tmdb");
  }

  private async tmdbSeason(series: ArchivedItem, season: number | null) {
    if (season === null) return null;
    const showId = await this.tmdbShowId(series);
    if (!showId) return null;
    const s = await this.tmdb<{ poster_path?: string | null }>(`/tv/${showId}/season/${season}`);
    return this.tmdbPoster(s?.poster_path, "tmdb");
  }

  private async tmdbPerson(name: string) {
    const s = await this.tmdb<{ results?: { profile_path?: string | null }[] }>(
      "/search/person",
      { query: name }
    );
    return this.tmdbPoster(s?.results?.[0]?.profile_path, "tmdb-search");
  }

  private async tvmazeShow(item: ArchivedItem) {
    type Show = { image?: { medium?: string; original?: string } | null };
    const ids = item.ProviderIds ?? {};
    let show: Show | null = null;
    if (ids.Imdb && /^tt\d+$/.test(ids.Imdb)) {
      show = await this.json<Show>(`https://api.tvmaze.com/lookup/shows?imdb=${ids.Imdb}`);
    }
    if (!show && ids.Tvdb && /^\d+$/.test(ids.Tvdb)) {
      show = await this.json<Show>(`https://api.tvmaze.com/lookup/shows?thetvdb=${ids.Tvdb}`);
    }
    if (!show && item.Name) {
      show = await this.json<Show>(
        `https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(item.Name)}`
      );
    }
    const url = show?.image?.medium ?? show?.image?.original;
    if (!url) return null;
    let host: string;
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:") return null;
      host = parsed.hostname;
    } catch {
      return null;
    }
    if (host !== "tvmaze.com" && !host.endsWith(".tvmaze.com")) return null;
    const image = await fetchImageBytes(this.fetchImpl, url);
    return image ? { image, source: "tvmaze" } : null;
  }

  private async coverArt(item: ArchivedItem) {
    const album =
      item.Type === "Audio" && item.AlbumId ? (this.archive.getItem(item.AlbumId) ?? item) : item;
    const ids = { ...(item.ProviderIds ?? {}), ...(album.ProviderIds ?? {}) };
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const candidates: string[] = [];
    if (ids.MusicBrainzAlbum && uuid.test(ids.MusicBrainzAlbum))
      candidates.push(`https://coverartarchive.org/release/${ids.MusicBrainzAlbum}/front-500`);
    if (ids.MusicBrainzReleaseGroup && uuid.test(ids.MusicBrainzReleaseGroup))
      candidates.push(
        `https://coverartarchive.org/release-group/${ids.MusicBrainzReleaseGroup}/front-500`
      );
    for (const url of candidates) {
      const image = await fetchImageBytes(this.fetchImpl, url);
      if (image) return { image, source: "coverartarchive" };
    }
    return null;
  }
}
