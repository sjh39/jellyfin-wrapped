// Serves the built frontend (dist/) from this server, for hosts without Docker or
// Apache (such as an Ultra.cc seedbox behind its nginx). Used only when STATIC_DIR is set.
//
// env.js carries the Jellyfin address the browser should use, and nothing else:
// in server mode no key of any kind is ever sent to the browser.
import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { extname, join, resolve, sep } from "node:path";
import type http from "node:http";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};
const URL_PATTERN = /^https?:\/\/[A-Za-z0-9._-]+(:[0-9]{1,5})?(\/[A-Za-z0-9._~/-]*)?$/;

export interface StaticOptions {
  dir: string;
  /** Path prefix, starting and ending with "/" (e.g. "/wrapped/"). */
  basePath: string;
  /** Jellyfin address as the browser reaches it. */
  publicJellyfinUrl: string;
}

export class StaticSite {
  private readonly root: string;
  private readonly index: Buffer;
  private readonly envJs: Buffer;
  private readonly csp: string;

  constructor(private readonly options: StaticOptions) {
    if (!URL_PATTERN.test(options.publicJellyfinUrl)) {
      throw new Error("PUBLIC_JELLYFIN_URL must look like https://host[:port][/path]");
    }
    this.root = realpathSync(resolve(options.dir));
    const indexPath = join(this.root, "index.html");
    if (!existsSync(indexPath)) {
      throw new Error(`STATIC_DIR (${options.dir}) has no index.html; run npm run build first`);
    }
    // Load env.js before the app starts. A separate file, so the page needs no inline script.
    this.index = Buffer.from(
      readFileSync(indexPath, "utf8").replace(
        /<head>/i,
        `<head><script src="${options.basePath}env.js"></script>`
      )
    );
    // Only the Jellyfin address. The admin key and the TMDB key never leave the server.
    this.envJs = Buffer.from(
      `window.ENV = { JELLYFIN_SERVER_URL: ${JSON.stringify(options.publicJellyfinUrl)} };\n`
    );
    const jellyfinOrigin = new URL(options.publicJellyfinUrl).origin;
    this.csp =
      "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
      `img-src 'self' data: blob: ${jellyfinOrigin}; font-src 'self' data:; ` +
      `connect-src 'self' ${jellyfinOrigin}; manifest-src 'self'; base-uri 'self'; ` +
      "form-action 'self'; frame-ancestors 'none'; object-src 'none'";
  }

  /** Serve a GET/HEAD for a path already stripped of the base path ("/assets/x.js"). */
  serve(req: http.IncomingMessage, res: http.ServerResponse, path: string): void {
    if (path === "/env.js") return this.send(res, req, this.envJs, TYPES[".js"]!, "no-store");

    let decoded: string;
    try {
      decoded = decodeURIComponent(path);
    } catch {
      return this.sendIndex(req, res);
    }
    const target = resolve(this.root, "." + decoded);
    // Never serve anything outside the build folder.
    if (target !== this.root && !target.startsWith(this.root + sep)) {
      return this.sendIndex(req, res);
    }
    if (target !== this.root && existsSync(target) && statSync(target).isFile()) {
      if (target === join(this.root, "index.html")) return this.sendIndex(req, res);
      const type = TYPES[extname(target).toLowerCase()] ?? "application/octet-stream";
      const cache = decoded.startsWith("/assets/")
        ? "public, max-age=31536000, immutable"
        : "no-cache";
      return this.send(res, req, readFileSync(target), type, cache);
    }
    // Client-side routes (/movies, /shows...) all load the app.
    return this.sendIndex(req, res);
  }

  private sendIndex(req: http.IncomingMessage, res: http.ServerResponse): void {
    this.send(res, req, this.index, TYPES[".html"]!, "no-cache");
  }

  private send(
    res: http.ServerResponse,
    req: http.IncomingMessage,
    body: Buffer,
    type: string,
    cache: string
  ): void {
    res.writeHead(200, {
      "Content-Type": type,
      "Content-Length": body.length,
      "Cache-Control": cache,
      "Content-Security-Policy": this.csp,
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "X-Frame-Options": "DENY",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    });
    res.end(req.method === "HEAD" ? undefined : body);
  }
}
