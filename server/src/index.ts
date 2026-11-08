import { join } from "node:path";
import { createApp } from "./app.js";
import { Archive } from "./archive.js";
import { loadConfig } from "./config.js";
import { ImageStore } from "./images.js";
import { JellyfinClient } from "./jellyfin.js";
import { Syncer } from "./sync.js";

const config = loadConfig();
const jellyfin = new JellyfinClient(config);

// The permanent archive: plays and items are copied here so a year's Wrapped
// still includes things the plugin has aged out or that were deleted from Jellyfin.
const archive = new Archive(join(config.archiveDir, "archive.sqlite"));
const images = new ImageStore(archive, jellyfin, config.archiveDir, config.tmdbApiKey);
const syncer = new Syncer(archive, jellyfin, images, {
  playSyncMs: config.playSyncMs,
  librarySyncMs: config.librarySyncMs,
});

const app = createApp({ config, jellyfin, archive: { archive, images, syncer } });

app.server.listen(config.port, "0.0.0.0", () => {
  console.log(`[server] Listening on port ${config.port}`);
  console.log(`[server] Archive at ${config.archiveDir}`);
  syncer.start();
});

const shutdown = (): void => {
  void app.close().then(() => {
    archive.close();
    process.exit(0);
  });
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
