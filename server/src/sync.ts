// Copies everything into the archive on a schedule:
//   plays     every PLAY_SYNC_MINUTES  (new plugin rows, plus the items they refer to)
//   library   every LIBRARY_SYNC_MINUTES (all items in every library, who can see which
//             library, and marks items that disappeared as deleted)
//   posters   after each pass, saves Jellyfin's poster for played items, movies and shows
import { compactItem, type Archive, type ArchivedItem } from "./archive.js";
import { isGuid, type JellyfinClient } from "./jellyfin.js";
import type { ImageStore } from "./images.js";
import { logEvent } from "./limits.js";

const PAGE_SIZE = 500;
const IDS_PER_REQUEST = 100;
const IMAGES_PER_PASS = 500;
const IMAGE_CONCURRENCY = 4;
/** Re-read plays a little before the newest archived one, in case rows were updated. */
const PLAY_OVERLAP_MS = 24 * 60 * 60 * 1000;
const ITEM_TYPES = "Movie,Series,Season,Episode,MusicAlbum,Audio,MusicVideo,Video";
const ITEM_FIELDS =
  "ParentId,People,Genres,ProviderIds,DateCreated,PremiereDate,ProductionYear";

interface ItemsPage {
  Items?: Record<string, unknown>[];
  TotalRecordCount?: number;
}
interface VirtualFolder {
  ItemId?: string;
  Name?: string;
}
interface JellyfinUserDto {
  Id?: string;
  Policy?: { EnableAllFolders?: boolean; EnabledFolders?: string[]; IsDisabled?: boolean };
}

/** "2025-03-01T12:00:00Z" -> "2025-03-01 12:00:00" (the plugin's format) */
function toPluginDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 19).replace("T", " ");
}

export class Syncer {
  private playsRunning: Promise<void> | null = null;
  private libraryRunning: Promise<void> | null = null;
  private lastPlaySync = 0;
  private timers: NodeJS.Timeout[] = [];

  constructor(
    private readonly archive: Archive,
    private readonly jellyfin: JellyfinClient,
    private readonly images: ImageStore,
    private readonly options: { playSyncMs: number; librarySyncMs: number }
  ) {}

  start(): void {
    // Library first so the plays pass can attach plays to real items.
    void this.syncLibrary().finally(() => void this.syncPlays());
    this.timers.push(
      setInterval(() => void this.syncPlays(), this.options.playSyncMs).unref(),
      setInterval(() => void this.syncLibrary(), this.options.librarySyncMs).unref()
    );
  }

  stop(): void {
    for (const t of this.timers) clearInterval(t);
    this.timers = [];
  }

  /** Sync plays unless that happened within maxAgeMs. Used before serving a user. */
  async syncPlaysIfStale(maxAgeMs: number): Promise<void> {
    if (Date.now() - this.lastPlaySync < maxAgeMs) return;
    await this.syncPlays();
  }

  syncPlays(): Promise<void> {
    this.playsRunning ??= this.runPlays()
      .catch((error: unknown) => logEvent("sync_plays_failed", { error: String(error) }))
      .finally(() => {
        this.playsRunning = null;
      });
    return this.playsRunning;
  }

  syncLibrary(): Promise<void> {
    this.libraryRunning ??= this.runLibrary()
      .catch((error: unknown) => logEvent("sync_library_failed", { error: String(error) }))
      .finally(() => {
        this.libraryRunning = null;
      });
    return this.libraryRunning;
  }

  private async runPlays(): Promise<void> {
    const latest = this.archive.latestPlayDate();
    const latestMs = latest
      ? Date.parse(latest.slice(0, 19).replace(" ", "T") + "Z")
      : NaN;
    const since = Number.isFinite(latestMs)
      ? toPluginDate(latestMs - PLAY_OVERLAP_MS)
      : null;
    const data = await this.jellyfin.fetchActivitySince(since);
    const count = this.archive.upsertPlays(data);
    this.lastPlaySync = Date.now();

    // Archive the items those plays refer to right away, so they survive a deletion
    // that happens before the next library pass.
    const unknown = this.archive.unknownPlayedItems();
    if (unknown.length > 0) {
      const found = await this.fetchItemsWithParents(unknown.map((u) => u.ItemId));
      const now = new Date().toISOString();
      this.archive.upsertItems(found, null, now);
      const stillMissing = unknown.filter((u) => !this.archive.hasItem(u.ItemId));
      if (stillMissing.length > 0) {
        const rebuilt = this.archive.synthesizeFromPlays(stillMissing, now);
        logEvent("sync_rebuilt_items", { count: rebuilt });
      }
    }
    logEvent("sync_plays", { rows: count });
    await this.saveImages();
  }

  private async runLibrary(): Promise<void> {
    const passStart = new Date().toISOString();
    const folders = await this.jellyfin.adminGet<VirtualFolder[]>("/Library/VirtualFolders");
    let total = 0;
    for (const folder of folders) {
      if (!folder.ItemId || !isGuid(folder.ItemId)) continue;
      const libraryId = folder.ItemId.replace(/-/g, "").toLowerCase();
      for (let start = 0; ; start += PAGE_SIZE) {
        const page = await this.jellyfin.adminGet<ItemsPage>(
          `/Items?ParentId=${folder.ItemId}&Recursive=true&IncludeItemTypes=${ITEM_TYPES}` +
            `&Fields=${ITEM_FIELDS}&EnableImages=false&StartIndex=${start}&Limit=${PAGE_SIZE}`
        );
        const items = (page.Items ?? [])
          .map(compactItem)
          .filter((i): i is ArchivedItem => i !== null);
        this.archive.upsertItems(items, libraryId, new Date().toISOString());
        total += items.length;
        if ((page.Items ?? []).length < PAGE_SIZE) break;
      }
    }

    // Only a complete pass may conclude that something was deleted.
    const deleted = this.archive.markMissingAsDeleted(passStart);
    await this.syncUserAccess();
    logEvent("sync_library", { items: total, newlyDeleted: deleted });
    await this.saveImages();
  }

  private async syncUserAccess(): Promise<void> {
    const users = await this.jellyfin.adminGet<JellyfinUserDto[]>("/Users");
    const access = new Map<string, string[]>();
    for (const user of users) {
      if (!user.Id || !isGuid(user.Id) || user.Policy?.IsDisabled) continue;
      const id = user.Id.replace(/-/g, "").toLowerCase();
      access.set(
        id,
        user.Policy?.EnableAllFolders
          ? ["*"]
          : (user.Policy?.EnabledFolders ?? []).map((f) => f.replace(/-/g, "").toLowerCase())
      );
    }
    this.archive.setUserLibraries(access);
  }

  /** Fetch items by id, then the seasons, shows and albums they belong to. */
  private async fetchItemsWithParents(ids: string[]): Promise<ArchivedItem[]> {
    const out: ArchivedItem[] = [];
    let pending = ids.filter(isGuid);
    const seen = new Set<string>();
    for (let round = 0; round < 3 && pending.length > 0; round++) {
      const next: string[] = [];
      for (let i = 0; i < pending.length; i += IDS_PER_REQUEST) {
        const batch = pending.slice(i, i + IDS_PER_REQUEST);
        batch.forEach((id) => seen.add(id));
        let page: ItemsPage;
        try {
          page = await this.jellyfin.adminGet<ItemsPage>(
            `/Items?Ids=${batch.join(",")}&Fields=${ITEM_FIELDS}&EnableImages=false`
          );
        } catch {
          continue;
        }
        for (const raw of page.Items ?? []) {
          const item = compactItem(raw);
          if (!item) continue;
          out.push(item);
          for (const parent of [item.ParentId, item.SeriesId, item.SeasonId, item.AlbumId]) {
            if (parent && isGuid(parent) && !seen.has(parent) && !this.archive.hasItem(parent))
              next.push(parent);
          }
        }
      }
      pending = [...new Set(next)];
    }
    return out;
  }

  private async saveImages(): Promise<void> {
    const ids = this.archive.itemsNeedingImages(IMAGES_PER_PASS);
    let saved = 0;
    for (let i = 0; i < ids.length; i += IMAGE_CONCURRENCY) {
      const results = await Promise.all(
        ids.slice(i, i + IMAGE_CONCURRENCY).map((id) => this.images.saveFromJellyfin(id))
      );
      saved += results.filter(Boolean).length;
    }
    if (ids.length > 0) logEvent("sync_images", { checked: ids.length, saved });
  }
}
