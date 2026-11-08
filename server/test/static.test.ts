import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";
import { createApp, type App } from "../src/app.js";
import { normalizeBasePath, type Config } from "../src/config.js";
import { JellyfinClient } from "../src/jellyfin.js";
import { StaticSite } from "../src/static.js";

const ADMIN = "admin-key-must-never-reach-a-browser";
const TMDB = "tmdb-token-must-never-reach-a-browser";

describe("serving the app under a sub-path", () => {
  let dir: string;
  let app: App;
  let base: string;

  before(async () => {
    dir = mkdtempSync(join(tmpdir(), "wrapped-dist-"));
    mkdirSync(join(dir, "assets"));
    writeFileSync(join(dir, "index.html"), "<html><head><title>W</title></head><body></body></html>");
    writeFileSync(join(dir, "assets", "app.js"), "console.log(1)");
    writeFileSync(join(tmpdir(), "outside.txt"), "outside");
    const config: Config = {
      jellyfinUrl: "http://127.0.0.1:9",
      apiKey: ADMIN,
      port: 0,
      cacheTtlMs: 1000,
      maxCachedUsers: 5,
      queryTimeoutMs: 500,
      maxResultRows: 100,
      maxResultBytes: 1024 * 1024,
      queryMemoryLimitMb: 16,
      rateLimitPerMinute: 1000,
      maxInflightPerUser: 4,
      maxQueuedPerUser: 64,
      maxConcurrentLoads: 3,
      authFailLimitPerMinute: 1000,
      trustProxyHops: 0,
      archiveDir: ":memory:",
      playSyncMs: 60000,
      librarySyncMs: 600000,
      tmdbApiKey: TMDB,
      basePath: "/wrapped/",
      staticDir: dir,
      publicJellyfinUrl: "https://media.example.com/jellyfin",
    };
    const site = new StaticSite({
      dir,
      basePath: config.basePath,
      publicJellyfinUrl: config.publicJellyfinUrl,
    });
    app = createApp({ config, jellyfin: new JellyfinClient(config), site });
    await new Promise<void>((r) => app.server.listen(0, "127.0.0.1", r));
    base = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
  });

  after(async () => {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  });

  const get = async (path: string) => {
    const res = await fetch(`${base}${path}`);
    return { status: res.status, type: res.headers.get("content-type"), body: await res.text(), res };
  };

  it("normalizes BASE_PATH", () => {
    assert.equal(normalizeBasePath(undefined), "/");
    assert.equal(normalizeBasePath("wrapped"), "/wrapped/");
    assert.equal(normalizeBasePath("/wrapped/"), "/wrapped/");
    assert.throws(() => normalizeBasePath("/wr apped"));
  });

  it("serves the page with env.js loaded first", async () => {
    const page = await get("/wrapped/");
    assert.equal(page.status, 200);
    assert.match(page.body, /<head><script src="\/wrapped\/env.js"><\/script>/);
    assert.match(page.res.headers.get("content-security-policy") ?? "", /connect-src 'self' https:\/\/media.example.com/);
  });

  it("sends app routes to the page, and files as files", async () => {
    assert.match((await get("/wrapped/movies")).body, /<title>W<\/title>/);
    const js = await get("/wrapped/assets/app.js");
    assert.equal(js.body, "console.log(1)");
    assert.match(js.type ?? "", /javascript/);
  });

  it("serves the API under the same prefix, and nothing outside it", async () => {
    assert.equal((await get("/wrapped/api/health")).status, 200);
    assert.equal((await get("/api/health")).status, 404);
    assert.equal((await get("/other/")).status, 404);
  });

  it("never serves files outside the build folder", async () => {
    for (const path of ["/wrapped/..%2Foutside.txt", "/wrapped/%2e%2e/outside.txt", "/wrapped/..%5Coutside.txt"]) {
      const res = await get(path);
      assert.doesNotMatch(res.body, /^outside$/, path);
    }
  });

  it("never sends the admin key or the TMDB key to the browser", async () => {
    const env = await get("/wrapped/env.js");
    assert.equal(env.body.trim(), 'window.ENV = { JELLYFIN_SERVER_URL: "https://media.example.com/jellyfin" };');
    for (const path of ["/wrapped/", "/wrapped/env.js", "/wrapped/movies", "/wrapped/assets/app.js"]) {
      const { body } = await get(path);
      assert.ok(!body.includes(ADMIN) && !body.includes(TMDB), path);
    }
  });
});
