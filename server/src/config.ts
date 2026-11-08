import { readFileSync } from "node:fs";

export interface Config {
  /** Address the server uses to reach Jellyfin (can differ from the address browsers use). */
  jellyfinUrl: string;
  /** Admin API key. Only ever sent to Jellyfin, never to browsers. */
  apiKey: string;
  port: number;
  /** How long a user's playback data copy is reused before it is fetched again. */
  cacheTtlMs: number;
  /** Maximum number of users whose data is held in memory at once. */
  maxCachedUsers: number;
  /** Per-query time limit. A query that exceeds it is stopped. */
  queryTimeoutMs: number;
  /** Maximum number of rows a single query may return. */
  maxResultRows: number;
  /** Maximum total size of one query's result, in bytes of text. */
  maxResultBytes: number;
  /** Memory SQLite may use per user database, in MiB. Stops string-bomb queries. */
  queryMemoryLimitMb: number;
  /** Requests per minute allowed for one signed-in user. */
  rateLimitPerMinute: number;
  /** Queries one user may run at the same time. */
  maxInflightPerUser: number;
  /** Queries one user may have waiting for a free slot before new ones are refused. */
  maxQueuedPerUser: number;
  /** Users whose data may be loading from Jellyfin at the same time. */
  maxConcurrentLoads: number;
  /** Failed sign-ins per minute allowed from one client address. */
  authFailLimitPerMinute: number;
  /** Number of reverse proxies in front of this server (0 = none, use the socket address). */
  trustProxyHops: number;
  /** Where the permanent archive (database and saved posters) lives. */
  archiveDir: string;
  /** How often new plays are copied into the archive. */
  playSyncMs: number;
  /** How often every library is re-read (this is what notices deleted items). */
  librarySyncMs: number;
  /** Optional TMDB key (v3 key or v4 read token) for finding posters of deleted items. */
  tmdbApiKey: string | undefined;
  /** Path prefix everything is served under, e.g. "/wrapped/". Always starts and ends with "/". */
  basePath: string;
  /** If set, this server also serves the built frontend from this folder. */
  staticDir: string | undefined;
  /** Jellyfin address as browsers reach it (defaults to JELLYFIN_SERVER_URL). */
  publicJellyfinUrl: string;
  /**
   * LOW_MEMORY=1: for hosts that cap a process's virtual memory (Ultra.cc: ~9.5 GB).
   * Per-user query databases use plain-JavaScript SQLite (slower, far smaller).
   */
  lowMemory: boolean;
}

/** "wrapped", "/wrapped", "/wrapped/" -> "/wrapped/"; "" -> "/" */
export function normalizeBasePath(raw: string | undefined): string {
  const trimmed = (raw ?? "").trim().replace(/^\/+|\/+$/g, "");
  if (trimmed === "") return "/";
  if (!/^[A-Za-z0-9._~-]+(\/[A-Za-z0-9._~-]+)*$/.test(trimmed)) {
    throw new Error(
      "BASE_PATH may only contain letters, digits, . _ ~ - and /"
    );
  }
  return `/${trimmed}/`;
}

function intFromEnv(
  env: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
  min: number,
  max: number
): number {
  const raw = env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }
  return value;
}

/**
 * The admin key comes from JELLYFIN_API_KEY, or from the file named by JELLYFIN_API_KEY_FILE.
 * A file keeps the key out of the process environment, `docker inspect` and crash reports.
 */
function readApiKey(
  env: NodeJS.ProcessEnv,
  readFile: (path: string) => string
): string | undefined {
  const file = env.JELLYFIN_API_KEY_FILE;
  if (!file) return env.JELLYFIN_API_KEY || undefined;
  if (env.JELLYFIN_API_KEY) {
    throw new Error(
      "Set either JELLYFIN_API_KEY or JELLYFIN_API_KEY_FILE, not both"
    );
  }
  let contents: string;
  try {
    contents = readFile(file);
  } catch {
    throw new Error(`Cannot read JELLYFIN_API_KEY_FILE (${file})`);
  }
  return contents.trim() || undefined;
}

/** A secret from NAME, or from the file named by NAME_FILE. Optional. */
function readOptionalSecret(
  env: NodeJS.ProcessEnv,
  name: string,
  readFile: (path: string) => string
): string | undefined {
  const file = env[`${name}_FILE`];
  if (!file) return env[name] || undefined;
  try {
    return readFile(file).trim() || undefined;
  } catch {
    throw new Error(`Cannot read ${name}_FILE (${file})`);
  }
}

export function loadConfig(
  env: NodeJS.ProcessEnv = process.env,
  readFile: (path: string) => string = (path) => readFileSync(path, "utf8")
): Config {
  const jellyfinUrl = env.JELLYFIN_SERVER_URL?.replace(/\/+$/, "");
  const apiKey = readApiKey(env, readFile);
  if (!jellyfinUrl || !apiKey) {
    throw new Error(
      "JELLYFIN_SERVER_URL and JELLYFIN_API_KEY (or JELLYFIN_API_KEY_FILE) must be set"
    );
  }

  return {
    jellyfinUrl,
    apiKey,
    port: intFromEnv(env, "PORT", 3000, 1, 65535),
    cacheTtlMs: intFromEnv(env, "CACHE_TTL_SECONDS", 300, 1, 86400) * 1000,
    maxCachedUsers: intFromEnv(env, "MAX_CACHED_USERS", 50, 1, 1000),
    queryTimeoutMs: intFromEnv(env, "QUERY_TIMEOUT_MS", 5000, 100, 60000),
    maxResultRows: intFromEnv(env, "MAX_RESULT_ROWS", 200000, 1, 5000000),
    maxResultBytes: intFromEnv(env, "MAX_RESULT_MB", 16, 1, 512) * 1024 * 1024,
    queryMemoryLimitMb: intFromEnv(env, "QUERY_MEMORY_LIMIT_MB", 128, 16, 2048),
    rateLimitPerMinute: intFromEnv(
      env,
      "RATE_LIMIT_PER_MINUTE",
      300,
      1,
      100000
    ),
    maxInflightPerUser: intFromEnv(env, "MAX_INFLIGHT_PER_USER", 4, 1, 100),
    maxQueuedPerUser: intFromEnv(env, "MAX_QUEUED_PER_USER", 64, 0, 1000),
    maxConcurrentLoads: intFromEnv(env, "MAX_CONCURRENT_LOADS", 3, 1, 100),
    authFailLimitPerMinute: intFromEnv(
      env,
      "AUTH_FAIL_LIMIT_PER_MINUTE",
      20,
      1,
      100000
    ),
    trustProxyHops: intFromEnv(env, "TRUST_PROXY_HOPS", 0, 0, 10),
    archiveDir: env.ARCHIVE_DIR || "./data",
    playSyncMs: intFromEnv(env, "PLAY_SYNC_MINUTES", 15, 1, 1440) * 60 * 1000,
    librarySyncMs:
      intFromEnv(env, "LIBRARY_SYNC_MINUTES", 60, 5, 10080) * 60 * 1000,
    tmdbApiKey: readOptionalSecret(env, "TMDB_API_KEY", readFile),
    basePath: normalizeBasePath(env.BASE_PATH),
    staticDir: env.STATIC_DIR || undefined,
    publicJellyfinUrl: (env.PUBLIC_JELLYFIN_URL || jellyfinUrl).replace(
      /\/+$/,
      ""
    ),
    lowMemory: env.LOW_MEMORY === "1" || env.LOW_MEMORY === "true",
  };
}
