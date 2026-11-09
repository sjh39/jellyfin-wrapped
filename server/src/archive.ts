// Permanent record of everything Wrapped needs, kept in a SQLite file on disk.
//
// The Playback Reporting plugin deletes plays older than its retention setting, and
// Jellyfin forgets an item (name, poster, show it belongs to) the moment its file is
// deleted. This archive copies both before they disappear, so a year's Wrapped still
// includes things that were watched and then removed from the server.
import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { ActivityData, ColumnDef } from "./jellyfin.js";

/** Columns kept for every play: the plugin's standard layout. */
export const PLAY_COLUMNS: ColumnDef[] = [
  { name: "DateCreated", type: "DATETIME" },
  { name: "UserId", type: "TEXT" },
  { name: "ItemId", type: "TEXT" },
  { name: "ItemType", type: "TEXT" },
  { name: "ItemName", type: "TEXT" },
  { name: "PlaybackMethod", type: "TEXT" },
  { name: "ClientName", type: "TEXT" },
  { name: "DeviceName", type: "TEXT" },
  { name: "PlayDuration", type: "INT" },
];

/** One review as the Jellyfin Enhanced plugin returns it. */
export interface PluginReview {
  userId?: string | null;
  mediaType?: string | null;
  tmdbId?: string | null;
  rating?: number | null;
  content?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface ReviewForUser {
  Rating: number | null;
  Content: string | null;
  CreatedAt: string | null;
  UpdatedAt: string | null;
  Item: ArchivedItem & { Deleted: boolean };
}

const TMDB_KEY = /^(\d+)(?::s(\d+)(?::e(\d+))?)?$/;

/** The parts of a Jellyfin item the frontend uses. Stored as JSON. */
export interface ArchivedItem {
  Id: string;
  Name?: string | null;
  Type?: string | null;
  ParentId?: string | null;
  SeriesId?: string | null;
  SeriesName?: string | null;
  SeasonId?: string | null;
  IndexNumber?: number | null;
  ParentIndexNumber?: number | null;
  ProductionYear?: number | null;
  CommunityRating?: number | null;
  PremiereDate?: string | null;
  RunTimeTicks?: number | null;
  Genres?: string[] | null;
  GenreItems?: { Name?: string | null; Id?: string }[] | null;
  People?:
    | {
        Id?: string;
        Name?: string | null;
        Role?: string | null;
        Type?: string | null;
      }[]
    | null;
  ProviderIds?: Record<string, string | null> | null;
  DateCreated?: string | null;
  AlbumId?: string | null;
  Album?: string | null;
  AlbumArtist?: string | null;
  /** Set on items rebuilt from play history after Jellyfin had already lost them. */
  Synthetic?: boolean;
}

export interface ImageRecord {
  file: string | null;
  contentType: string | null;
  source: string | null;
  fetchedAt: string;
  missing: boolean;
}

const MAX_PEOPLE = 25;

/** Keep only what the app needs; Jellyfin items can be large. */
export function compactItem(raw: Record<string, unknown>): ArchivedItem | null {
  const id = raw.Id;
  if (typeof id !== "string") return null;
  const pick = <T>(key: string): T | null =>
    raw[key] === undefined ? null : (raw[key] as T);
  const people = pick<ArchivedItem["People"]>("People");
  return {
    Id: id,
    Name: pick("Name"),
    Type: pick("Type"),
    ParentId: pick("ParentId"),
    SeriesId: pick("SeriesId"),
    SeriesName: pick("SeriesName"),
    SeasonId: pick("SeasonId"),
    IndexNumber: pick("IndexNumber"),
    ParentIndexNumber: pick("ParentIndexNumber"),
    ProductionYear: pick("ProductionYear"),
    CommunityRating: pick("CommunityRating"),
    PremiereDate: pick("PremiereDate"),
    RunTimeTicks: pick("RunTimeTicks"),
    Genres: pick("Genres"),
    GenreItems: pick("GenreItems"),
    People: people
      ? people.slice(0, MAX_PEOPLE).map((p) => ({
          Id: p.Id,
          Name: p.Name,
          Role: p.Role,
          Type: p.Type,
        }))
      : null,
    ProviderIds: pick("ProviderIds"),
    DateCreated: pick("DateCreated"),
    AlbumId: pick("AlbumId"),
    Album: pick("Album"),
    AlbumArtist: pick("AlbumArtist"),
  };
}

/** A stable 32-hex id for an item rebuilt from play history. */
export function syntheticId(...parts: (string | number)[]): string {
  return createHash("md5")
    .update(["synthetic", ...parts].join("\u0000").toLowerCase())
    .digest("hex");
}

/** "Show - s01e02 - Title" (the plugin's episode naming) */
const EPISODE_NAME = /^(.*?) - s(\d+)e(\d+)(?:-?e?\d+)? - (.*)$/i;

export function parseEpisodeName(
  name: string
): { series: string; season: number; episode: number; title: string } | null {
  const m = EPISODE_NAME.exec(name);
  if (!m) return null;
  return {
    series: m[1]!.trim(),
    season: Number(m[2]),
    episode: Number(m[3]),
    title: m[4]!.trim(),
  };
}

type Row = Record<string, unknown>;
const str = (v: unknown): string | null => (typeof v === "string" ? v : null);

export class Archive {
  readonly db: DatabaseSync;

  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA busy_timeout = 5000;

      CREATE TABLE IF NOT EXISTS plays (
        id INTEGER PRIMARY KEY,
        DateCreated TEXT NOT NULL,
        UserId TEXT NOT NULL,
        ItemId TEXT NOT NULL,
        ItemType TEXT,
        ItemName TEXT,
        PlaybackMethod TEXT,
        ClientName TEXT,
        DeviceName TEXT,
        PlayDuration INTEGER,
        UNIQUE (DateCreated, UserId, ItemId)
      );
      CREATE INDEX IF NOT EXISTS plays_user ON plays (UserId, DateCreated);
      CREATE INDEX IF NOT EXISTS plays_item ON plays (ItemId);

      CREATE TABLE IF NOT EXISTS items (
        Id TEXT PRIMARY KEY,
        Type TEXT,
        Name TEXT,
        ParentId TEXT,
        LibraryId TEXT,
        DateCreated TEXT,
        Json TEXT NOT NULL,
        FirstSeen TEXT NOT NULL,
        LastSeen TEXT NOT NULL,
        Deleted INTEGER NOT NULL DEFAULT 0,
        Synthetic INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS items_created ON items (DateCreated);
      CREATE INDEX IF NOT EXISTS items_type_name ON items (Type, Name);
      CREATE INDEX IF NOT EXISTS items_parent ON items (ParentId);

      CREATE TABLE IF NOT EXISTS people (
        Id TEXT PRIMARY KEY,
        Name TEXT NOT NULL
      );

      -- Which libraries each user can open ('*' = all of them).
      CREATE TABLE IF NOT EXISTS user_libraries (
        UserId TEXT NOT NULL,
        LibraryId TEXT NOT NULL,
        PRIMARY KEY (UserId, LibraryId)
      );

      -- Who may see an item that has no library (rebuilt from someone's plays).
      CREATE TABLE IF NOT EXISTS item_viewers (
        ItemId TEXT NOT NULL,
        UserId TEXT NOT NULL,
        PRIMARY KEY (ItemId, UserId)
      );

      CREATE TABLE IF NOT EXISTS images (
        Id TEXT PRIMARY KEY,
        File TEXT,
        ContentType TEXT,
        Source TEXT,
        FetchedAt TEXT NOT NULL,
        Missing INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS meta (
        Key TEXT PRIMARY KEY,
        Value TEXT
      );

      -- Star ratings and reviews from the Jellyfin Enhanced plugin, keyed the way it keys
      -- them: TmdbKey is "603" for a movie or show, "1399:s1" for a season, "1399:s1:e2"
      -- for an episode.
      CREATE TABLE IF NOT EXISTS reviews (
        UserId TEXT NOT NULL,
        MediaType TEXT NOT NULL,
        TmdbKey TEXT NOT NULL,
        Rating REAL,
        Content TEXT,
        CreatedAt TEXT,
        UpdatedAt TEXT,
        PRIMARY KEY (UserId, MediaType, TmdbKey)
      );
    `);
  }

  close(): void {
    this.db.close();
  }

  private transaction(fn: () => void): void {
    this.db.exec("BEGIN");
    try {
      fn();
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  getMeta(key: string): string | null {
    const row = this.db
      .prepare("SELECT Value FROM meta WHERE Key = ?")
      .get(key);
    return str(row?.Value);
  }

  setMeta(key: string, value: string): void {
    this.db
      .prepare(
        "INSERT INTO meta (Key, Value) VALUES (?, ?) ON CONFLICT(Key) DO UPDATE SET Value = excluded.Value"
      )
      .run(key, value);
  }

  // ---- plays ------------------------------------------------------------

  /** Copy plugin rows in. A play already archived is updated, never duplicated. */
  upsertPlays(data: ActivityData): number {
    const index = new Map(data.columns.map((c, i) => [c.name, i + 1]));
    const at = (row: string[], name: string): string | null => {
      const i = index.get(name);
      return i === undefined ? null : (row[i] ?? null);
    };
    const insert = this.db.prepare(`
      INSERT INTO plays (DateCreated, UserId, ItemId, ItemType, ItemName,
                         PlaybackMethod, ClientName, DeviceName, PlayDuration)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (DateCreated, UserId, ItemId) DO UPDATE SET
        ItemType = excluded.ItemType,
        ItemName = excluded.ItemName,
        PlaybackMethod = excluded.PlaybackMethod,
        ClientName = excluded.ClientName,
        DeviceName = excluded.DeviceName,
        PlayDuration = excluded.PlayDuration
    `);
    let count = 0;
    this.transaction(() => {
      for (const row of data.rows) {
        const date = at(row, "DateCreated");
        const user = at(row, "UserId");
        const item = at(row, "ItemId");
        if (!date || !user || !item) continue;
        const duration = Number(at(row, "PlayDuration") ?? 0);
        insert.run(
          date,
          user,
          item,
          at(row, "ItemType"),
          at(row, "ItemName"),
          at(row, "PlaybackMethod"),
          at(row, "ClientName"),
          at(row, "DeviceName"),
          Number.isFinite(duration) ? Math.trunc(duration) : 0
        );
        count++;
      }
    });
    return count;
  }

  latestPlayDate(): string | null {
    const row = this.db
      .prepare("SELECT MAX(DateCreated) AS d FROM plays")
      .get();
    return str(row?.d);
  }

  /** One user's full play history, in the shape the per-user query database expects. */
  userActivity(userId: string): ActivityData {
    const rows = this.db
      .prepare(
        `SELECT id, DateCreated, UserId, ItemId, ItemType, ItemName, PlaybackMethod,
                ClientName, DeviceName, PlayDuration
           FROM plays WHERE UserId = ? ORDER BY DateCreated, id`
      )
      .all(userId);
    return {
      columns: PLAY_COLUMNS,
      rows: rows.map((r) => [
        String(r.id),
        ...PLAY_COLUMNS.map((c) =>
          r[c.name] === null || r[c.name] === undefined ? "" : String(r[c.name])
        ),
      ]),
    };
  }

  /** Played item ids that the archive knows nothing about yet. */
  unknownPlayedItems(): {
    ItemId: string;
    ItemType: string | null;
    ItemName: string | null;
  }[] {
    return this.db
      .prepare(
        `SELECT ItemId, MAX(ItemType) AS ItemType, MAX(ItemName) AS ItemName
           FROM plays
          WHERE ItemId NOT IN (SELECT Id FROM items)
          GROUP BY ItemId`
      )
      .all()
      .map((r) => ({
        ItemId: String(r.ItemId),
        ItemType: str(r.ItemType),
        ItemName: str(r.ItemName),
      }));
  }

  // ---- items ------------------------------------------------------------

  hasItem(id: string): boolean {
    return !!this.db.prepare("SELECT 1 FROM items WHERE Id = ?").get(id);
  }

  getItem(id: string): (ArchivedItem & { LibraryId: string | null }) | null {
    const row = this.db
      .prepare("SELECT Json, LibraryId FROM items WHERE Id = ?")
      .get(id);
    if (!row) return null;
    return {
      ...(JSON.parse(String(row.Json)) as ArchivedItem),
      LibraryId: str(row.LibraryId),
    };
  }

  /** Save items seen in Jellyfin right now. Marks them as present again. */
  upsertItems(
    items: ArchivedItem[],
    libraryId: string | null,
    now: string
  ): void {
    const upsert = this.db.prepare(`
      INSERT INTO items (Id, Type, Name, ParentId, LibraryId, DateCreated, Json,
                         FirstSeen, LastSeen, Deleted, Synthetic)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)
      ON CONFLICT (Id) DO UPDATE SET
        Type = excluded.Type,
        Name = excluded.Name,
        ParentId = excluded.ParentId,
        LibraryId = COALESCE(excluded.LibraryId, items.LibraryId),
        DateCreated = COALESCE(excluded.DateCreated, items.DateCreated),
        Json = excluded.Json,
        LastSeen = excluded.LastSeen,
        Deleted = 0,
        Synthetic = 0
    `);
    const person = this.db.prepare(
      "INSERT INTO people (Id, Name) VALUES (?, ?) ON CONFLICT(Id) DO UPDATE SET Name = excluded.Name"
    );
    this.transaction(() => {
      for (const item of items) {
        upsert.run(
          item.Id,
          item.Type ?? null,
          item.Name ?? null,
          item.ParentId ?? null,
          libraryId,
          item.DateCreated ?? null,
          JSON.stringify(item),
          now,
          now
        );
        for (const p of item.People ?? []) {
          if (p.Id && p.Name) person.run(p.Id, p.Name);
        }
      }
    });
  }

  /** After a complete library pass: anything not seen in it is gone from Jellyfin. */
  markMissingAsDeleted(passStartedAt: string): number {
    const result = this.db
      .prepare(
        "UPDATE items SET Deleted = 1 WHERE Synthetic = 0 AND Deleted = 0 AND LastSeen < ?"
      )
      .run(passStartedAt);
    return Number(result.changes);
  }

  /**
   * Rebuild items that were played but were already gone from Jellyfin before they
   * could be archived, using the name the plugin stored with the play. An episode is
   * attached to its show if the show is still known, otherwise to a rebuilt show.
   */
  synthesizeFromPlays(
    missing: {
      ItemId: string;
      ItemType: string | null;
      ItemName: string | null;
    }[],
    now: string
  ): number {
    const insert = this.db.prepare(`
      INSERT INTO items (Id, Type, Name, ParentId, LibraryId, DateCreated, Json,
                         FirstSeen, LastSeen, Deleted, Synthetic)
      VALUES (?, ?, ?, ?, NULL, NULL, ?, ?, ?, 1, 1)
      ON CONFLICT (Id) DO NOTHING
    `);
    const viewer = this.db.prepare(
      "INSERT OR IGNORE INTO item_viewers (ItemId, UserId) SELECT ?, UserId FROM plays WHERE ItemId = ?"
    );
    const findSeries = this.db.prepare(
      "SELECT Id FROM items WHERE Type = 'Series' AND Name = ? COLLATE NOCASE AND Synthetic = 0 LIMIT 1"
    );
    const findSeason = this.db.prepare(
      `SELECT Id FROM items WHERE Type = 'Season' AND ParentId = ?
          AND json_extract(Json, '$.IndexNumber') = ? LIMIT 1`
    );
    const add = (item: ArchivedItem, sourcePlayItem: string): void => {
      insert.run(
        item.Id,
        item.Type ?? null,
        item.Name ?? null,
        item.ParentId ?? null,
        JSON.stringify({ ...item, Synthetic: true }),
        now,
        now
      );
      viewer.run(item.Id, sourcePlayItem);
    };

    let count = 0;
    this.transaction(() => {
      for (const m of missing) {
        const name = m.ItemName ?? "Unknown";
        const parsed = m.ItemType === "Episode" ? parseEpisodeName(name) : null;
        if (!parsed) {
          add({ Id: m.ItemId, Name: name, Type: m.ItemType }, m.ItemId);
          count++;
          continue;
        }
        const seriesId =
          str(findSeries.get(parsed.series)?.Id) ??
          syntheticId("series", parsed.series);
        add({ Id: seriesId, Name: parsed.series, Type: "Series" }, m.ItemId);
        const seasonId =
          str(findSeason.get(seriesId, parsed.season)?.Id) ??
          syntheticId("season", parsed.series, parsed.season);
        add(
          {
            Id: seasonId,
            Name: parsed.season === 0 ? "Specials" : `Season ${parsed.season}`,
            Type: "Season",
            ParentId: seriesId,
            SeriesId: seriesId,
            SeriesName: parsed.series,
            IndexNumber: parsed.season,
          },
          m.ItemId
        );
        add(
          {
            Id: m.ItemId,
            Name: parsed.title,
            Type: "Episode",
            ParentId: seasonId,
            SeriesId: seriesId,
            SeasonId: seasonId,
            SeriesName: parsed.series,
            IndexNumber: parsed.episode,
            ParentIndexNumber: parsed.season,
          },
          m.ItemId
        );
        count++;
      }
    });
    return count;
  }

  // ---- access -----------------------------------------------------------

  setUserLibraries(access: Map<string, string[]>): void {
    const insert = this.db.prepare(
      "INSERT OR IGNORE INTO user_libraries (UserId, LibraryId) VALUES (?, ?)"
    );
    this.transaction(() => {
      this.db.exec("DELETE FROM user_libraries");
      for (const [userId, libraries] of access) {
        for (const lib of libraries) insert.run(userId, lib);
      }
    });
  }

  /**
   * An item is visible to a user if it lives in a library they can open, they played
   * it (or something inside it), or it was rebuilt from their plays.
   */
  private static readonly VISIBLE = `
    (
      EXISTS (SELECT 1 FROM user_libraries ul
               WHERE ul.UserId = $user AND (ul.LibraryId = '*' OR ul.LibraryId = i.LibraryId))
      OR EXISTS (SELECT 1 FROM item_viewers v WHERE v.ItemId = i.Id AND v.UserId = $user)
      OR EXISTS (SELECT 1 FROM plays p WHERE p.UserId = $user AND p.ItemId = i.Id)
      OR EXISTS (SELECT 1 FROM plays p JOIN items c ON c.Id = p.ItemId
                  WHERE p.UserId = $user
                    AND (c.ParentId = i.Id
                         OR json_extract(c.Json, '$.SeriesId') = i.Id
                         OR json_extract(c.Json, '$.AlbumId') = i.Id))
    )`;

  /** Archived items by id, limited to what this user may see. */
  itemsForUser(
    userId: string,
    ids: string[]
  ): (ArchivedItem & { Deleted: boolean })[] {
    if (ids.length === 0) return [];
    const stmt = this.db.prepare(
      `SELECT i.Json, i.Deleted FROM items i
        WHERE i.Id = $id AND ${Archive.VISIBLE}`
    );
    const out: (ArchivedItem & { Deleted: boolean })[] = [];
    for (const id of ids) {
      const row = stmt.get({ id, user: userId });
      if (row) {
        out.push({
          ...(JSON.parse(String(row.Json)) as ArchivedItem),
          Deleted: Number(row.Deleted) === 1,
        });
      }
    }
    return out;
  }

  canUserSee(userId: string, id: string): boolean {
    if (this.db.prepare("SELECT 1 FROM people WHERE Id = ?").get(id))
      return true;
    return !!this.db
      .prepare(`SELECT 1 FROM items i WHERE i.Id = $id AND ${Archive.VISIBLE}`)
      .get({ id, user: userId });
  }

  /** Movies, shows and episodes added in a date range (deleted ones included), for one user. */
  additionsForUser(
    userId: string,
    start: string,
    end: string
  ): (ArchivedItem & { Deleted: boolean; Played: boolean })[] {
    return this.db
      .prepare(
        `SELECT i.Json, i.Deleted,
                EXISTS (SELECT 1 FROM plays p WHERE p.UserId = $user AND p.ItemId = i.Id) AS Played
           FROM items i
          WHERE i.Type IN ('Movie', 'Series', 'Episode')
            AND i.Synthetic = 0
            AND i.DateCreated >= $start AND i.DateCreated < $end
            AND ${Archive.VISIBLE}
          ORDER BY i.DateCreated DESC`
      )
      .all({ user: userId, start, end })
      .map((r) => ({
        ...(JSON.parse(String(r.Json)) as ArchivedItem),
        Deleted: Number(r.Deleted) === 1,
        Played: Number(r.Played) === 1,
      }));
  }

  // ---- reviews ----------------------------------------------------------

  /**
   * Make the archive's reviews match the plugin's. Unlike plays, a review the author
   * deleted is gone for good: it was their choice, not something Jellyfin forgot.
   */
  replaceReviews(reviews: PluginReview[]): number {
    const insert = this.db.prepare(
      `INSERT OR REPLACE INTO reviews (UserId, MediaType, TmdbKey, Rating, Content, CreatedAt, UpdatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    let count = 0;
    this.transaction(() => {
      this.db.exec("DELETE FROM reviews");
      for (const r of reviews) {
        const user =
          typeof r.userId === "string"
            ? r.userId.replace(/-/g, "").toLowerCase()
            : "";
        const type = r.mediaType;
        const key = r.tmdbId ?? "";
        if (
          !/^[0-9a-f]{32}$/.test(user) ||
          (type !== "movie" && type !== "tv") ||
          !TMDB_KEY.test(key)
        )
          continue;
        const rating =
          typeof r.rating === "number" && Number.isFinite(r.rating)
            ? r.rating
            : null;
        insert.run(
          user,
          type,
          key,
          rating,
          r.content ?? null,
          r.createdAt ?? null,
          r.updatedAt ?? null
        );
        count++;
      }
    });
    return count;
  }

  /**
   * One user's reviews written or last changed in a date range, each matched to the
   * movie, show, season or episode it is about. Reviews of things this user cannot see,
   * or that the archive has never heard of, are left out.
   */
  reviewsForUser(userId: string, start: string, end: string): ReviewForUser[] {
    const rows = this.db
      .prepare(
        `SELECT MediaType, TmdbKey, Rating, Content, CreatedAt, UpdatedAt FROM reviews
          WHERE UserId = $user
            AND COALESCE(NULLIF(UpdatedAt, ''), CreatedAt) >= $start
            AND COALESCE(NULLIF(UpdatedAt, ''), CreatedAt) < $end`
      )
      .all({ user: userId, start, end });
    const series = `SELECT Id FROM items WHERE Type = 'Series' AND json_extract(Json, '$.ProviderIds.Tmdb') = $tmdb`;
    const lookups = {
      movie: `i.Type = 'Movie' AND json_extract(i.Json, '$.ProviderIds.Tmdb') = $tmdb`,
      show: `i.Type = 'Series' AND json_extract(i.Json, '$.ProviderIds.Tmdb') = $tmdb`,
      season: `i.Type = 'Season' AND json_extract(i.Json, '$.IndexNumber') = $season
               AND json_extract(i.Json, '$.SeriesId') IN (${series})`,
      episode: `i.Type = 'Episode' AND json_extract(i.Json, '$.ParentIndexNumber') = $season
                AND json_extract(i.Json, '$.IndexNumber') = $episode
                AND json_extract(i.Json, '$.SeriesId') IN (${series})`,
    };
    const out: ReviewForUser[] = [];
    for (const r of rows) {
      const m = TMDB_KEY.exec(String(r.TmdbKey));
      if (!m) continue;
      const [, tmdb, season, episode] = m;
      const kind =
        r.MediaType === "movie"
          ? "movie"
          : episode
            ? "episode"
            : season
              ? "season"
              : "show";
      const found = this.db
        .prepare(
          `SELECT i.Json, i.Deleted FROM items i
            WHERE ${lookups[kind]} AND ${Archive.VISIBLE}
            ORDER BY i.Deleted LIMIT 1`
        )
        .get({
          user: userId,
          tmdb: tmdb!,
          ...(season ? { season: Number(season) } : {}),
          ...(episode ? { episode: Number(episode) } : {}),
        });
      if (!found) continue;
      out.push({
        Rating: typeof r.Rating === "number" ? r.Rating : null,
        Content: str(r.Content),
        CreatedAt: str(r.CreatedAt),
        UpdatedAt: str(r.UpdatedAt),
        Item: {
          ...(JSON.parse(String(found.Json)) as ArchivedItem),
          Deleted: Number(found.Deleted) === 1,
        },
      });
    }
    return out;
  }

  personName(id: string): string | null {
    return str(
      this.db.prepare("SELECT Name FROM people WHERE Id = ?").get(id)?.Name
    );
  }

  // ---- images -----------------------------------------------------------

  getImage(id: string): ImageRecord | null {
    const row = this.db.prepare("SELECT * FROM images WHERE Id = ?").get(id) as
      | Row
      | undefined;
    if (!row) return null;
    return {
      file: str(row.File),
      contentType: str(row.ContentType),
      source: str(row.Source),
      fetchedAt: String(row.FetchedAt),
      missing: Number(row.Missing) === 1,
    };
  }

  setImage(id: string, record: ImageRecord): void {
    this.db
      .prepare(
        `INSERT INTO images (Id, File, ContentType, Source, FetchedAt, Missing)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(Id) DO UPDATE SET File = excluded.File, ContentType = excluded.ContentType,
           Source = excluded.Source, FetchedAt = excluded.FetchedAt, Missing = excluded.Missing`
      )
      .run(
        id,
        record.file,
        record.contentType,
        record.source,
        record.fetchedAt,
        record.missing ? 1 : 0
      );
  }

  /**
   * Items whose poster should be saved while Jellyfin still has it: anything played,
   * the seasons/shows/albums around it, and every movie and show.
   */
  itemsNeedingImages(limit: number): string[] {
    return this.db
      .prepare(
        `WITH wanted AS (
           SELECT Id FROM items WHERE Type IN ('Movie', 'Series') AND Deleted = 0
           UNION SELECT ItemId FROM plays
           UNION SELECT c.ParentId FROM items c JOIN plays p ON p.ItemId = c.Id
           UNION SELECT json_extract(c.Json, '$.SeriesId') FROM items c JOIN plays p ON p.ItemId = c.Id
           UNION SELECT json_extract(c.Json, '$.AlbumId') FROM items c JOIN plays p ON p.ItemId = c.Id
         )
         SELECT w.Id FROM wanted w
           JOIN items i ON i.Id = w.Id AND i.Deleted = 0 AND i.Synthetic = 0
          WHERE w.Id IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM images im WHERE im.Id = w.Id)
          LIMIT ?`
      )
      .all(limit)
      .map((r) => String(r.Id));
  }

  stats(): Record<string, number> {
    const n = (sql: string): number =>
      Number(this.db.prepare(sql).get()?.n ?? 0);
    return {
      plays: n("SELECT COUNT(*) AS n FROM plays"),
      items: n("SELECT COUNT(*) AS n FROM items"),
      deletedItems: n("SELECT COUNT(*) AS n FROM items WHERE Deleted = 1"),
      rebuiltItems: n("SELECT COUNT(*) AS n FROM items WHERE Synthetic = 1"),
      images: n("SELECT COUNT(*) AS n FROM images WHERE Missing = 0"),
    };
  }
}
