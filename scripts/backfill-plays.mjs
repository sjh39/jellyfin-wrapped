#!/usr/bin/env node
// One-time backfill of plays from before the Playback Reporting plugin was installed.
//
// Wrapped counts plays from the archive's `plays` table, which only starts when the plugin
// did. Jellyfin still remembers two partial traces of earlier viewing:
//   1. the activity log: "X is playing Y" / "X has finished playing Y", with real times,
//      so a start/stop pair gives a real date and minutes watched. Jellyfin prunes it.
//   2. each user's watch state: played, play count and last-played date per item. It
//      reaches further back but keeps only the latest date, and no minutes (we assume the
//      full runtime).
// This turns both into play rows dated before the first real play, marked
// PlaybackMethod = 'Backfill' so they can be told apart or removed.
//
// Usage (on the server, from the repo root):
//   node scripts/backfill-plays.mjs            dry run: prints what it would add
//   node scripts/backfill-plays.mjs --apply    adds the rows (backs up the archive first)
//   node scripts/backfill-plays.mjs --undo     removes every backfilled row
// Options: --env <file> (default .env.server), --year <yyyy> (default this year).
// Stop the service before --apply / --undo and start it after, so its caches rebuild.
import { copyFileSync, existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const MARK = "Backfill";
const ITEM_TYPES = "Movie,Episode,Audio,MusicVideo";
const PAGE = 500;

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const year = Number(option("--year", new Date().getFullYear()));
const yearStart = `${year}-01-01 00:00:00`;
const yearEnd = `${year + 1}-01-01 00:00:00`;

// ---- settings: the same .env.server the service uses ----------------------------------

const envFile = resolve(option("--env", ".env.server"));
if (!existsSync(envFile))
  fail(`No settings file at ${envFile}. Run from the repo root or pass --env.`);
const env = Object.fromEntries(
  readFileSync(envFile, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const i = line.indexOf("=");
      return [
        line.slice(0, i).trim(),
        line
          .slice(i + 1)
          .trim()
          .replace(/^["']|["']$/g, ""),
      ];
    })
);
const server = (env.JELLYFIN_SERVER_URL || "").replace(/\/+$/, "");
const token = env.JELLYFIN_API_KEY_FILE
  ? readFileSync(env.JELLYFIN_API_KEY_FILE, "utf8").trim()
  : env.JELLYFIN_API_KEY;
const dbPath = join(env.ARCHIVE_DIR || "./data", "archive.sqlite");
if (!existsSync(dbPath)) fail(`No archive at ${dbPath}.`);

const db = new DatabaseSync(dbPath);
db.exec("PRAGMA busy_timeout = 5000");

if (flag("--undo")) {
  const n = db
    .prepare("SELECT COUNT(*) AS n FROM plays WHERE PlaybackMethod = ?")
    .get(MARK).n;
  if (n) backup();
  db.prepare("DELETE FROM plays WHERE PlaybackMethod = ?").run(MARK);
  console.log(`Removed ${n} backfilled plays.`);
  process.exit(0);
}
if (!server || !token)
  fail("JELLYFIN_SERVER_URL and the API key must be set in the settings file.");

// ---- what the archive already has ------------------------------------------------------

const already = db
  .prepare("SELECT COUNT(*) AS n FROM plays WHERE PlaybackMethod = ?")
  .get(MARK).n;
if (already && flag("--apply"))
  fail(
    `${already} backfilled plays are already in. Run --undo first to redo them.`
  );

// Backfill only reaches up to the first real play: from there on the plugin has it all.
const cutoff =
  db
    .prepare(
      "SELECT MIN(DateCreated) AS d FROM plays WHERE PlaybackMethod IS NOT ?"
    )
    .get(MARK).d || yearEnd;
const until = cutoff < yearEnd ? cutoff : yearEnd;
console.log(
  `Backfilling ${yearStart.slice(0, 10)} up to ${until} (first recorded play).`
);

// ---- Jellyfin ----------------------------------------------------------------------------

async function api(path) {
  const res = await fetch(`${server}${path}`, {
    headers: {
      Authorization: `MediaBrowser Client="Jellyfin Wrapped", Device="Server", DeviceId="jellyfin-wrapped-backfill", Version="1.0.0", Token="${token}"`,
      "X-Emby-Token": token,
    },
  });
  if (!res.ok) fail(`Jellyfin ${res.status} for ${path.split("?")[0]}`);
  return res.json();
}

/** "2026-03-01T12:00:00.1234567Z" -> "2026-03-01 12:00:00" (the plugin's format, UTC) */
const toPluginDate = (iso) =>
  new Date(iso).toISOString().slice(0, 19).replace("T", " ");
const guid = (id) => (id ? String(id).replace(/-/g, "").toLowerCase() : null);
const runtimeSeconds = (item) => Math.round((item?.RunTimeTicks ?? 0) / 1e7);
const inRange = (date) => date >= yearStart && date < until;

/** The plugin's naming: "Show - s01e02 - Title" for episodes, the plain name otherwise. */
function itemName(item) {
  if (item.Type !== "Episode") return item.Name ?? "";
  const pad = (n) => String(n ?? 0).padStart(2, "0");
  return `${item.SeriesName ?? ""} - s${pad(item.ParentIndexNumber)}e${pad(item.IndexNumber)} - ${item.Name ?? ""}`;
}

const users = (await api("/Users")).map((u) => ({
  id: guid(u.Id),
  name: u.Name,
}));
const userName = new Map(users.map((u) => [u.id, u.name]));

// 1. Activity log: pair each stop with the latest earlier start of the same item by the same user.
const entries = [];
for (let start = 0; ; start += PAGE) {
  const page = await api(
    `/System/ActivityLog/Entries?startIndex=${start}&limit=${PAGE}&minDate=${year}-01-01T00:00:00Z`
  );
  entries.push(...(page.Items ?? []));
  if (!page.Items?.length || start + PAGE >= (page.TotalRecordCount ?? 0))
    break;
}
const playback = entries
  .filter(
    (e) => /Playback(Stopped)?$/.test(e.Type ?? "") && e.ItemId && e.UserId
  )
  .map((e) => ({
    type: e.Type,
    user: guid(e.UserId),
    item: guid(e.ItemId),
    at: Date.parse(e.Date),
  }))
  .sort((a, b) => a.at - b.at);
const oldestLog = entries.length
  ? toPluginDate(
      new Date(
        Math.min(...entries.map((e) => Date.parse(e.Date)))
      ).toISOString()
    )
  : null;

const openStarts = new Map();
const logPlays = [];
for (const e of playback) {
  const key = `${e.user}|${e.item}`;
  if (!e.type.endsWith("Stopped")) {
    openStarts.set(key, e.at);
    continue;
  }
  const started = openStarts.get(key);
  openStarts.delete(key);
  logPlays.push({
    user: e.user,
    item: e.item,
    start: started ?? null,
    stop: e.at,
  });
}

// Item details (type, name, runtime) for everything the log mentions.
const items = new Map();
async function loadItems(ids) {
  const missing = [...new Set(ids)].filter((id) => !items.has(id));
  for (let i = 0; i < missing.length; i += 100) {
    const page = await api(
      `/Items?ids=${missing.slice(i, i + 100).join(",")}&fields=RunTimeTicks,SeriesName&enableUserData=false`
    );
    for (const item of page.Items ?? []) items.set(guid(item.Id), item);
  }
}
await loadItems(logPlays.map((p) => p.item));

const rows = [];
const seen = new Set();
for (const p of logPlays) {
  const item = items.get(p.item);
  if (!item || !ITEM_TYPES.split(",").includes(item.Type)) continue;
  const full = runtimeSeconds(item);
  // Pauses make stop - start longer than the watch, so never count more than the runtime.
  const watched = p.start ? Math.round((p.stop - p.start) / 1000) : full;
  const seconds = full ? Math.min(watched, full) : watched;
  const date = toPluginDate(
    new Date(p.start ?? p.stop - seconds * 1000).toISOString()
  );
  if (!inRange(date) || seconds < 60) continue;
  rows.push({ date, user: p.user, item, seconds, source: "activity log" });
  seen.add(`${p.user}|${p.item}`);
}

// 2. Watch state: the last-played date of everything each user has finished.
for (const user of users) {
  for (let start = 0; ; start += PAGE) {
    const page = await api(
      `/Items?userId=${user.id}&recursive=true&isPlayed=true&includeItemTypes=${ITEM_TYPES}` +
        `&fields=RunTimeTicks,SeriesName&enableUserData=true&startIndex=${start}&limit=${PAGE}`
    );
    for (const item of page.Items ?? []) {
      const last = item.UserData?.LastPlayedDate;
      if (!last || seen.has(`${user.id}|${guid(item.Id)}`)) continue;
      const seconds = runtimeSeconds(item);
      const date = toPluginDate(last);
      if (!inRange(date) || !seconds) continue;
      rows.push({ date, user: user.id, item, seconds, source: "watch state" });
    }
    if (!page.Items?.length || start + PAGE >= (page.TotalRecordCount ?? 0))
      break;
  }
}

// ---- report --------------------------------------------------------------------------------

console.log(
  `Activity log: ${entries.length} entries since ${year}-01-01, oldest ${oldestLog ?? "none"}.`
);
const byUser = new Map();
for (const r of rows) {
  const s = byUser.get(r.user) ?? {
    "activity log": 0,
    "watch state": 0,
    seconds: 0,
    types: {},
  };
  s[r.source]++;
  s.seconds += r.seconds;
  s.types[r.item.Type] = (s.types[r.item.Type] ?? 0) + 1;
  byUser.set(r.user, s);
}
for (const [user, s] of byUser) {
  const types = Object.entries(s.types)
    .map(([t, n]) => `${n} ${t}`)
    .join(", ");
  console.log(
    `  ${userName.get(user) ?? user}: ${s["activity log"] + s["watch state"]} plays ` +
      `(${s["activity log"]} from activity log, ${s["watch state"]} from watch state; ${types}), ` +
      `about ${Math.round(s.seconds / 3600)} hours`
  );
}
if (!rows.length) console.log("  Nothing to backfill.");

if (!flag("--apply")) {
  console.log(
    "\nDry run: nothing written. Run again with --apply to add these plays."
  );
  process.exit(0);
}

// ---- write ---------------------------------------------------------------------------------

backup();
const insert = db.prepare(`
  INSERT OR IGNORE INTO plays (DateCreated, UserId, ItemId, ItemType, ItemName,
                               PlaybackMethod, ClientName, DeviceName, PlayDuration)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
let added = 0;
db.exec("BEGIN");
try {
  for (const r of rows) {
    const result = insert.run(
      r.date,
      r.user,
      guid(r.item.Id),
      r.item.Type,
      itemName(r.item),
      MARK,
      `${MARK} (${r.source})`,
      "",
      r.seconds
    );
    added += Number(result.changes);
  }
  db.exec("COMMIT");
} catch (error) {
  db.exec("ROLLBACK");
  throw error;
}
console.log(
  `\nAdded ${added} plays. Start the service again so Wrapped picks them up.`
);

// ---- helpers -------------------------------------------------------------------------------

function backup() {
  db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
  const copy = `${dbPath}.before-backfill-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  copyFileSync(dbPath, copy);
  console.log(`Backed up the archive to ${copy}`);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
