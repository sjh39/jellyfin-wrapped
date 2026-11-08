# Jellyfin Wrapped server

A small backend that lets Jellyfin Wrapped work **without putting the admin API key in the
browser**. The frontend runs in "server mode" whenever it is started without
`JELLYFIN_API_KEY`.

## How it works

1. The browser signs in to Jellyfin with the user's own account, as before.
2. It sends the page's SQL to `POST /api/playback-report` with that user's Jellyfin token
   (`Authorization: Bearer <token>`).
3. The server asks Jellyfin who the token belongs to (`GET /Users/Me`). The user id comes
   from Jellyfin, never from the request.
4. Using the admin API key, the server reads that one user's rows from the Playback
   Reporting plugin and loads them into a throwaway in-memory SQLite database (sql.js,
   WebAssembly, in a worker thread).
5. The SQL runs against that database, read-only. The response has the plugin's own shape
   (`{"colums": [...], "results": [...]}`), so the frontend's queries are unchanged.

Because the database only contains the signed-in user's rows, a query cannot read anyone
else's data, whatever it says.

## Security model

| Concern          | What the server does                                                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Admin API key    | Only ever sent to Jellyfin. Never in a response, a log line, or the browser.                                                                     |
| Whose data       | Taken from the verified token. Cross-user queries return nothing.                                                                                |
| What SQL may run | One `SELECT` or `WITH` statement. No writes, no `ATTACH`, no `PRAGMA`. The database is also opened `query_only`.                                 |
| Runaway queries  | Per-query timeout; the worker thread is terminated. Result limits in rows and bytes.                                                             |
| Memory bombs     | SQLite hard heap limit per user database (`QUERY_MEMORY_LIMIT_MB`).                                                                              |
| Abuse            | Per-user request rate and concurrency limits. Failed sign-ins per client address are limited; users already verified keep working.               |
| Load on Jellyfin | Verified tokens are cached for 60 s. At most `MAX_CONCURRENT_LOADS` users load data at once. Each user's data is reused for `CACHE_TTL_SECONDS`. |
| Browsers         | No CORS headers (same origin only), `Cache-Control: no-store`, strict response headers.                                                          |
| Logging          | One JSON line per notable event. Tokens and SQL text are never logged.                                                                           |

Not covered here: TLS (terminate it at your reverse proxy), and the Jellyfin login itself,
which the browser performs directly against Jellyfin. Your Jellyfin must be reachable from
users' browsers.

## Configuration

| Variable                     | Default  | Meaning                                                                     |
| ---------------------------- | -------- | --------------------------------------------------------------------------- |
| `JELLYFIN_SERVER_URL`        | required | Address the server uses to reach Jellyfin.                                  |
| `JELLYFIN_API_KEY`           | required | Admin API key.                                                              |
| `JELLYFIN_API_KEY_FILE`      | -        | Read the admin key from this file instead. Keeps it out of the environment. |
| `PORT`                       | `3000`   | Listen port.                                                                |
| `CACHE_TTL_SECONDS`          | `300`    | How long a user's data copy is reused.                                      |
| `MAX_CACHED_USERS`           | `50`     | Users held in memory at once.                                               |
| `QUERY_TIMEOUT_MS`           | `5000`   | Per-query time limit.                                                       |
| `MAX_RESULT_ROWS`            | `200000` | Rows one query may return.                                                  |
| `MAX_RESULT_MB`              | `16`     | Size of one query's result.                                                 |
| `QUERY_MEMORY_LIMIT_MB`      | `128`    | SQLite memory per user database.                                            |
| `RATE_LIMIT_PER_MINUTE`      | `300`    | Requests per user per minute.                                               |
| `MAX_INFLIGHT_PER_USER`      | `4`      | Queries one user may run at once.                                           |
| `MAX_QUEUED_PER_USER`        | `64`     | Queries one user may have waiting; more get a 429.                          |
| `MAX_CONCURRENT_LOADS`       | `3`      | Users loading data from Jellyfin at once.                                   |
| `AUTH_FAIL_LIMIT_PER_MINUTE` | `20`     | Failed sign-ins per client address per minute.                              |
| `TRUST_PROXY_HOPS`           | `0`      | Reverse proxies in front of this server. See below.                         |

### Putting it behind reverse proxies

Rate limits per client address only work if the server knows the real address. With
`TRUST_PROXY_HOPS=0` it uses the connecting address, which behind a proxy is the proxy
itself, so **every** client would share one failed-sign-in budget. Set it to the number of
proxies that append to `X-Forwarded-For` between the internet and this server (the bundled
frontend container counts as one). The server takes the entry that many places from the
right, so a client cannot choose its own address by sending the header.

Check it: make a request with a bad token and confirm the `auth_failed` log line shows your
real address, not a container address.

### Plugin retention

The Playback Reporting plugin deletes history older than its retention setting (about three
months by default). Raise it in the plugin settings if you want previous years.

## Development

Needs Node 22 or newer.

```bash
cd server
npm ci
npm test            # builds, then runs the tests
JELLYFIN_SERVER_URL=http://localhost:8096 JELLYFIN_API_KEY=... npm run dev
```

`npm run dev` builds once and starts the server; restart it after changes. The frontend's
Vite dev server proxies `/api` to `http://localhost:3000` (override with
`WRAPPED_SERVER_URL`), so run `npm run dev` in the repo root without `VITE_JELLYFIN_API_KEY`
set.

## Permanent archive

The server keeps its own copy of everything Wrapped needs in `ARCHIVE_DIR`
(`archive.sqlite` plus an `images/` folder), so a year's Wrapped still includes:

- plays the Playback Reporting plugin has deleted because of its retention setting
- movies, episodes and music that were deleted from Jellyfin (or replaced by a new
  file, which gives them a new id)

How it works:

| Job | When | What it does |
| --- | --- | --- |
| Plays | at start, every `PLAY_SYNC_MINUTES` (15), and before serving a user if older than a minute | Copies new plugin rows in. Items those plays refer to are archived immediately, with their season, show or album. |
| Library | at start and every `LIBRARY_SYNC_MINUTES` (60) | Reads every library, records which users can open which library, and marks items that disappeared as deleted. |
| Posters | after each pass | Saves Jellyfin's poster for every played item (and its show/season/album) and every movie and show. |

Items deleted before the archive existed are rebuilt from the plugin's play rows
(episodes are attached to their show if the show is still known). Their posters are
found on request: Jellyfin first, then TMDB (`TMDB_API_KEY`, optional), TVmaze for
shows, and Cover Art Archive for music. Lookups that find nothing are retried after a
week.

Endpoints (all require the user's own Jellyfin token, and only return items the user
can see: items in libraries they can open, or items they played):

- `POST /api/items` `{"ids": [...]}`: archived copies of items Jellyfin no longer has
- `GET /api/library-additions?start=YYYY-MM-DD&end=YYYY-MM-DD`: items added in a range,
  with `Deleted` and `Played`
- `GET /api/image/<id>`: poster
- `GET /api/archive/status`: counts of archived plays, items, deleted items and posters

Back up `ARCHIVE_DIR`. It is the only copy of anything that has since been deleted.
Requires Node 22.13 or newer (uses the built-in `node:sqlite`).

## Hosting without Docker (Ultra.cc and similar)

The server can serve the web pages itself, under a sub-path, so one Node process and
one port is all a shared host needs:

```
BASE_PATH=/wrapped/ npm run build                 # frontend, in the repo root
cd server && npm ci && npm run build
```

Settings (in `.env.server`, which git ignores):

| Setting | Example | Purpose |
| --- | --- | --- |
| `BASE_PATH` | `/wrapped/` | Prefix for the pages and the API. Same value as the build. |
| `STATIC_DIR` | `/home/you/jellyfin-wrapped/dist` | Serve the built pages from this server. |
| `PUBLIC_JELLYFIN_URL` | `https://you.host.usbx.me/jellyfin` | Jellyfin as browsers reach it, if different. |
| `TRUST_PROXY_HOPS` | `1` | One reverse proxy (the host's nginx) in front. |

Nginx forwards the whole path, prefix included:

```
location /wrapped/ {
    proxy_pass http://127.0.0.1:PORT;
    proxy_http_version 1.1;
    proxy_set_header X-Forwarded-Host $http_host;
}
```

`env.js` only ever contains the Jellyfin address. The admin key and TMDB key stay
on the server.

## Keeping keys out of git

API keys are protected secrets. Keep them in files outside the repo (for example
`~/.secrets/`, mode 600) and point `JELLYFIN_API_KEY_FILE` / `TMDB_API_KEY_FILE`
at them. `.gitignore` excludes env files, `.secrets/`, key files and the archive,
and `scripts/check-secrets.sh` runs before every commit (via husky) and blocks
anything that looks like a key or token. Run `npm run check-secrets` to scan the
whole repo.
