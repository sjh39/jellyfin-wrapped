# Jellyfin Wrapped (Ultra.cc edition)

A Spotify Wrapped–style year in review for a Jellyfin server, set up to run on an
[Ultra.cc](https://ultra.cc) seedbox and rebuilt with a new poster-wall interface.

This is a fork of [johnpc/jellyfin-wrapped](https://github.com/johnpc/jellyfin-wrapped).
The stats and queries come from upstream. This fork changes how it is hosted, what it
remembers and how it looks.

> **Security:** run it in **server mode** (the default here). The admin API key stays on
> the backend and each viewer only ever sees their own plays. Don't set
> `VITE_JELLYFIN_API_KEY` / `JELLYFIN_API_KEY` on the frontend for a shared server: that
> puts the admin key in the page, where anyone who opens the site can read it.

## What's different from upstream

| Area               | Upstream                                                                | This fork                                                                                                                            |
| ------------------ | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Hosting            | Docker, served from `/`                                                 | One Node process on one port, under a sub-path (`/wrapped/`) behind Ultra.cc's nginx. No Docker needed. Docker still works.          |
| Shared-host limits | –                                                                       | `LOW_MEMORY` mode and bounded workers so Node runs under Ultra.cc's per-process virtual-memory cap (~9.5 GB).                        |
| History            | Whatever the Playback Reporting plugin still has (≈3 months by default) | Permanent archive of plays, items and posters. Wrapped still counts things you deleted from Jellyfin or that aged out of the plugin. |
| Deleted items      | Missing posters / dropped                                               | Posters recovered from Jellyfin, then TMDB, TVmaze (shows) and Cover Art Archive (music). "New this year" includes deleted items.    |
| Interface          | Card pages with a nav bar                                               | Full redesign (see below).                                                                                                           |
| Secrets            | Env vars                                                                | Keys can be read from files outside the repo (`*_FILE`); a pre-commit hook blocks anything that looks like a key.                    |

## The redesign

Every page was rebuilt as a poster-wall "story":

- **One sign-in screen.** Username and password. The server address is built in, so viewers
  are never asked for it. Returning viewers with a valid session go straight in.
- **Story navigation.** Move between slides with the on-screen buttons, the **← / →** keys,
  a TV remote's d-pad, or a swipe on phones. Empty slides are skipped automatically.
- **Chapter menu** (press **M**): jump to any slide, change the time range, turn screening
  mode on or off, sign out.
- **Screening mode** (press **Space**): slides advance on their own every 12 seconds for a
  TV or projector. Any key hands control back.
- **Layouts for phone, desktop and TV/projector,** with reduced-motion support.
- **About and credits** slide with the TMDB / TVmaze / Cover Art Archive attribution.

Slides: Top 10, First watched, Movies, TV shows, Music, Music videos, Favorite actors,
Genres, Live TV, Critically acclaimed, Oldest movie, Oldest show, New this year, Holidays,
Watch time, Show of the month, Unfinished shows, Devices, Activity calendar, About and
credits.

## Requirements

- Jellyfin 10.8+ with the official
  [Playback Reporting plugin](https://github.com/jellyfin/jellyfin-plugin-playbackreporting).
  Raise the plugin's retention if you want past years; the archive keeps everything from
  the day you start it.
- A Jellyfin admin API key (Dashboard → API Keys → +).
- Node **22.13 or newer** (the archive uses the built-in `node:sqlite`).
- Optional: a free [TMDB](https://www.themoviedb.org/settings/api) key (the "API Read
  Access Token") to find posters for items deleted before they were archived.

## Install on Ultra.cc

All commands run over SSH on your seedbox. Replace `USER`, `HOST` and `PORT` with your own
values. Your public address is `https://USER.HOST.usbx.me`.

### 1. Get the code and Node

```bash
cd ~
git clone https://github.com/sjh39/jellyfin-wrapped.git
cd jellyfin-wrapped
node -v        # needs v22.13+. If not, install it (e.g. with nvm) first.
```

### 2. Pick a port

```bash
app-ports free     # choose one from your assigned range
```

Only use a port from your range.

### 3. Store the keys outside the repo

```bash
mkdir -p ~/.secrets && chmod 700 ~/.secrets
printf '%s' 'YOUR-JELLYFIN-ADMIN-KEY' > ~/.secrets/jellyfin-key
printf '%s' 'YOUR-TMDB-READ-TOKEN'   > ~/.secrets/tmdb-key   # optional
chmod 600 ~/.secrets/*
```

### 4. Configure

```bash
cp .env.server.example .env.server    # git ignores this file
nano .env.server
```

Set at least:

```bash
JELLYFIN_SERVER_URL=https://USER.HOST.usbx.me/jellyfin
JELLYFIN_API_KEY_FILE=/home/USER/.secrets/jellyfin-key
TMDB_API_KEY_FILE=/home/USER/.secrets/tmdb-key
PORT=PORT
BASE_PATH=/wrapped/
STATIC_DIR=/home/USER/jellyfin-wrapped/dist
ARCHIVE_DIR=/home/USER/jellyfin-wrapped-data
TRUST_PROXY_HOPS=1

# Ultra.cc caps virtual memory per process. Without these Node runs out of address space.
LOW_MEMORY=1
MALLOC_ARENA_MAX=2
NODE_OPTIONS=--disable-wasm-trap-handler
MAX_CACHED_USERS=25
```

If the backend should reach Jellyfin at a different address than browsers do, set
`JELLYFIN_SERVER_URL` to the internal one and `PUBLIC_JELLYFIN_URL` to the public one.

### 5. Build

```bash
npm ci
MALLOC_ARENA_MAX=2 NODE_OPTIONS=--disable-wasm-trap-handler BASE_PATH=/wrapped/ npm run build
npm run server:install
npm --prefix server run build
```

`BASE_PATH` must match the value in `.env.server`.

### 6. Run it as a service

```bash
mkdir -p ~/.config/systemd/user
which node    # use this path in ExecStart below
nano ~/.config/systemd/user/jellyfin-wrapped.service
```

```ini
[Unit]
Description=Jellyfin Wrapped
After=network-online.target

[Service]
Type=exec
WorkingDirectory=%h/jellyfin-wrapped/server
EnvironmentFile=%h/jellyfin-wrapped/.env.server
ExecStart=/full/path/to/node dist/src/index.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
```

```bash
systemctl --user daemon-reload
systemctl --user enable --now jellyfin-wrapped.service
systemctl --user status jellyfin-wrapped.service
journalctl --user -u jellyfin-wrapped.service -f    # logs
```

### 7. Put it behind nginx

```bash
nano ~/.apps/nginx/proxy.d/jellyfin-wrapped.conf
```

```nginx
location /wrapped/ {
    proxy_pass http://127.0.0.1:PORT;
    proxy_http_version 1.1;
    proxy_set_header X-Forwarded-Host $http_host;
}
```

No trailing slash after the port: the server expects the `/wrapped/` prefix.

```bash
app-nginx restart
```

Open `https://USER.HOST.usbx.me/wrapped/` and sign in with a Jellyfin account.

### Updating

```bash
cd ~/jellyfin-wrapped && git pull
npm ci && MALLOC_ARENA_MAX=2 NODE_OPTIONS=--disable-wasm-trap-handler BASE_PATH=/wrapped/ npm run build
npm --prefix server ci && npm --prefix server run build
systemctl --user restart jellyfin-wrapped.service
```

### Back up the archive

`ARCHIVE_DIR` (`archive.sqlite` plus `images/`) is the only copy of plays and posters for
anything since deleted. Back it up.

## How the backend works

1. The browser signs in to Jellyfin with the viewer's own account.
2. It sends each slide's query to the backend with that viewer's token.
3. The backend asks Jellyfin whose token it is, loads only that user's plays into a
   throwaway in-memory database, and runs the query read-only. Cross-user queries return
   nothing.
4. A background sync copies new plays every 15 minutes and re-reads every library every
   hour, which is how deleted items are noticed.

The full security model, every setting and the archive endpoints are in
[`server/README.md`](server/README.md).

## Other ways to run it

**Docker (any host that allows it):**

```bash
cp .env.server.example .env.server            # set the API key
# set JELLYFIN_SERVER_URL in docker-compose.server.yaml
docker compose -f docker-compose.server.yaml up -d --build
```

The compose file mounts a `wrapped-archive` volume for the archive. Keep it.

**Local development:**

```bash
npm install
npm run server:install
JELLYFIN_SERVER_URL=http://localhost:8096 JELLYFIN_API_KEY=... npm run server:dev   # backend on :3000
npm run dev                                                                          # frontend, proxies /api
```

Leave `VITE_JELLYFIN_API_KEY` unset so the frontend uses the backend.

## Keeping keys out of git

`.gitignore` excludes env files, `.secrets/`, key files and the archive.
`scripts/check-secrets.sh` runs before every commit (husky) and blocks anything that looks
like a key or token. Scan the whole repo with `npm run check-secrets`. Tests:
`npm run server:test`.

## Credits

- Original project: [johnpc/jellyfin-wrapped](https://github.com/johnpc/jellyfin-wrapped).
- This product uses the TMDB API but is not endorsed or certified by TMDB. Show posters may
  come from [TVmaze](https://www.tvmaze.com) (CC BY-SA 4.0) and music art from the
  [Cover Art Archive](https://coverartarchive.org).

## License

MIT. See [LICENSE](LICENSE).
