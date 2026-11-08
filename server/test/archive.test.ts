import assert from "node:assert/strict";
import http from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";
import { Archive, PLAY_COLUMNS, parseEpisodeName, syntheticId } from "../src/archive.js";
import { createApp, type App } from "../src/app.js";
import type { Config } from "../src/config.js";
import { ImageStore } from "../src/images.js";
import { JellyfinClient } from "../src/jellyfin.js";
import { Syncer } from "../src/sync.js";

const U1 = "11111111111111111111111111111111";
const U2 = "22222222222222222222222222222222";
const LIB_MOVIES = "a0000000000000000000000000000001";
const LIB_PRIVATE = "a0000000000000000000000000000002";
const MOVIE = "b0000000000000000000000000000001";
const PRIVATE_MOVIE = "b0000000000000000000000000000002";
const SERIES = "c0000000000000000000000000000001";
const SEASON = "c0000000000000000000000000000002";
const EP_GONE = "c0000000000000000000000000000003";
const PNG = Buffer.from(
  "89504e470d0a1a0a0000000d4948445200000001000000010806000000" +
    "1f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082",
  "hex"
);

const playRow = (id: number, date: string, user: string, item: string, type: string, name: string) => [
  String(id), date, user, item, type, name, "DirectPlay", "web", "tv", "3600",
];

describe("archive", () => {
  it("parses the plugin's episode names", () => {
    assert.deepEqual(parseEpisodeName("The Show - s02e05 - Pilot, Part 2"), {
      series: "The Show",
      season: 2,
      episode: 5,
      title: "Pilot, Part 2",
    });
    assert.equal(parseEpisodeName("Just A Movie"), null);
  });

  it("keeps each play once even when synced repeatedly", () => {
    const a = new Archive(":memory:");
    const data = {
      columns: PLAY_COLUMNS,
      rows: [playRow(1, "2025-01-01 10:00:00", U1, MOVIE, "Movie", "Film")],
    };
    a.upsertPlays(data);
    a.upsertPlays(data);
    assert.equal(a.userActivity(U1).rows.length, 1);
    assert.equal(a.userActivity(U2).rows.length, 0);
    a.close();
  });

  it("rebuilds a deleted episode under its show when the show is still known", () => {
    const a = new Archive(":memory:");
    a.upsertItems([{ Id: SERIES, Name: "The Show", Type: "Series" }], LIB_MOVIES, "2025-01-01");
    a.upsertPlays({
      columns: PLAY_COLUMNS,
      rows: [playRow(1, "2025-02-01 10:00:00", U1, EP_GONE, "Episode", "The Show - s01e03 - Gone")],
    });
    a.synthesizeFromPlays(a.unknownPlayedItems(), "2025-03-01");
    const ep = a.getItem(EP_GONE);
    assert.equal(ep?.Type, "Episode");
    assert.equal(ep?.Name, "Gone");
    const season = a.getItem(ep!.ParentId!);
    assert.equal(season?.ParentId, SERIES, "episode should hang off the real show");
    a.close();
  });

  it("rebuilds an unknown show with a stable id", () => {
    const a = new Archive(":memory:");
    a.upsertPlays({
      columns: PLAY_COLUMNS,
      rows: [playRow(1, "2025-02-01 10:00:00", U1, EP_GONE, "Episode", "Other Show - s01e01 - A")],
    });
    a.synthesizeFromPlays(a.unknownPlayedItems(), "2025-03-01");
    const season = a.getItem(a.getItem(EP_GONE)!.ParentId!);
    assert.equal(season?.ParentId, syntheticId("series", "Other Show"));
    // Only the user who played it can see the rebuilt items.
    assert.equal(a.itemsForUser(U1, [season!.ParentId!]).length, 1);
    assert.equal(a.itemsForUser(U2, [season!.ParentId!]).length, 0);
    a.close();
  });

  it("only shows items from libraries the user can open", () => {
    const a = new Archive(":memory:");
    a.upsertItems([{ Id: MOVIE, Name: "Public", Type: "Movie" }], LIB_MOVIES, "2025-01-01");
    a.upsertItems([{ Id: PRIVATE_MOVIE, Name: "Private", Type: "Movie" }], LIB_PRIVATE, "2025-01-01");
    a.setUserLibraries(new Map([[U1, ["*"]], [U2, [LIB_MOVIES]]]));
    assert.equal(a.itemsForUser(U1, [MOVIE, PRIVATE_MOVIE]).length, 2);
    assert.deepEqual(a.itemsForUser(U2, [MOVIE, PRIVATE_MOVIE]).map((i) => i.Id), [MOVIE]);
    assert.equal(a.canUserSee(U2, PRIVATE_MOVIE), false);
    a.close();
  });
});

describe("deleted items end to end", () => {
  let jellyfin: http.Server;
  let app: App;
  let base: string;
  let archive: Archive;
  let syncer: Syncer;
  let dir: string;
  let movieDeleted = false;

  before(async () => {
    dir = mkdtempSync(join(tmpdir(), "wrapped-archive-"));
    jellyfin = http.createServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://x");
      const json = (body: unknown) => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(body));
      };
      const movie = {
        Id: MOVIE,
        Name: "Soon Deleted",
        Type: "Movie",
        DateCreated: "2025-03-01T12:00:00.0000000Z",
        ProductionYear: 2020,
      };
      if (url.pathname === "/Users/Me") return json({ Id: U1, Name: "u1" });
      if (url.pathname === "/user_usage_stats/submit_custom_query") {
        let body = "";
        req.on("data", (c: Buffer) => (body += c.toString()));
        req.on("end", () => {
          const q = (JSON.parse(body) as { CustomQueryString: string }).CustomQueryString;
          if (q.includes("pragma_table_info")) return json({ colums: ["name", "type"], results: [] });
          json({
            colums: ["__rowid", ...PLAY_COLUMNS.map((c) => c.name)],
            results: [playRow(1, "2025-03-02 20:00:00", U1, MOVIE, "Movie", "Soon Deleted")],
          });
        });
        return;
      }
      if (url.pathname === "/Library/VirtualFolders") return json([{ ItemId: LIB_MOVIES, Name: "Movies" }]);
      if (url.pathname === "/Users") return json([{ Id: U1, Policy: { EnableAllFolders: true } }]);
      if (url.pathname === "/Items") return json({ Items: movieDeleted ? [] : [movie] });
      if (url.pathname === `/Items/${MOVIE}/Images/Primary` && !movieDeleted) {
        res.writeHead(200, { "Content-Type": "image/png" });
        return res.end(PNG);
      }
      res.writeHead(404);
      res.end();
    });
    await new Promise<void>((r) => jellyfin.listen(0, "127.0.0.1", r));
    const jellyfinUrl = `http://127.0.0.1:${(jellyfin.address() as AddressInfo).port}`;
    const config: Config = {
      jellyfinUrl,
      apiKey: "admin",
      port: 0,
      cacheTtlMs: 1,
      maxCachedUsers: 5,
      queryTimeoutMs: 2000,
      maxResultRows: 1000,
      maxResultBytes: 1024 * 1024,
      queryMemoryLimitMb: 64,
      rateLimitPerMinute: 1000,
      maxInflightPerUser: 4,
      maxQueuedPerUser: 64,
      maxConcurrentLoads: 3,
      authFailLimitPerMinute: 1000,
      trustProxyHops: 0,
      archiveDir: dir,
      playSyncMs: 60000,
      librarySyncMs: 600000,
      tmdbApiKey: undefined,
      basePath: "/",
      staticDir: undefined,
      publicJellyfinUrl: jellyfinUrl,
    };
    const client = new JellyfinClient(config);
    archive = new Archive(join(dir, "archive.sqlite"));
    const images = new ImageStore(archive, client, dir, undefined);
    syncer = new Syncer(archive, client, images, { playSyncMs: 60000, librarySyncMs: 600000 });
    app = createApp({ config, jellyfin: client, archive: { archive, images, syncer } });
    await new Promise<void>((r) => app.server.listen(0, "127.0.0.1", r));
    base = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
  });

  after(async () => {
    await app.close();
    archive.close();
    jellyfin.closeAllConnections();
    await new Promise<void>((r) => jellyfin.close(() => r()));
    rmSync(dir, { recursive: true, force: true });
  });

  const get = (path: string) =>
    fetch(`${base}${path}`, { headers: { Authorization: "Bearer token-1" } });

  it("keeps the movie, its play and its poster after Jellyfin deletes it", async () => {
    await syncer.syncLibrary();
    await syncer.syncPlays();
    assert.equal(archive.getImage(MOVIE)?.source, "jellyfin", "poster saved while it existed");

    movieDeleted = true;
    await syncer.syncLibrary();

    const additions = (await (await get("/api/library-additions?start=2025-01-01&end=2026-01-01")).json()) as {
      Items: { Id: string; Deleted: boolean; Played: boolean }[];
    };
    assert.deepEqual(additions.Items.map((i) => [i.Id, i.Deleted, i.Played]), [[MOVIE, true, true]]);

    const items = (await (
      await fetch(`${base}/api/items`, {
        method: "POST",
        headers: { Authorization: "Bearer token-1", "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [MOVIE] }),
      })
    ).json()) as { Items: { Name: string }[] };
    assert.equal(items.Items[0]?.Name, "Soon Deleted");

    const image = await get(`/api/image/${MOVIE}`);
    assert.equal(image.status, 200);
    assert.equal(image.headers.get("content-type"), "image/png");
    assert.ok(Buffer.from(await image.arrayBuffer()).equals(PNG));

    const report = await fetch(`${base}/api/playback-report`, {
      method: "POST",
      headers: { Authorization: "Bearer token-1", "Content-Type": "application/json" },
      body: JSON.stringify({ query: "SELECT ItemName FROM PlaybackActivity" }),
    });
    const rows = (await report.json()) as { results: string[][] };
    assert.deepEqual(rows.results, [["Soon Deleted"]]);
  });

  it("refuses images and items without a valid login", async () => {
    const res = await fetch(`${base}/api/image/${MOVIE}`);
    assert.equal(res.status, 401);
  });
});
