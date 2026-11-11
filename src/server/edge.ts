// What server.mjs does at the HTTP edge besides the security headers and the PIN gate: a permanent redirect off a
// trailing slash, a year's immutable caching for the content-hashed files under /assets/, and gzip for the app's own
// HTML, JSON and XML (srvx's static middleware already compresses static files). Web APIs only, no secrets.

/** A 308 from `/about/?x=1` to `/about?x=1` for GET/HEAD page paths, or null. Never for /api or /media, and never a
 * path that would turn into a protocol-relative `//host` Location. */
export function trailingSlashRedirect(request: Request): Response | null {
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  const url = new URL(request.url);
  const { pathname } = url;
  if (pathname.length < 2 || !pathname.endsWith("/") || pathname.startsWith("//")) return null;
  if (/^\/(api|media)(\/|$)/.test(pathname)) return null;
  return new Response(null, { status: 308, headers: { Location: pathname.replace(/\/+$/, "") + url.search, "Cache-Control": "public, max-age=3600" } });
}

export const IMMUTABLE = "public, max-age=31536000, immutable";

/** Every file Vite writes under /assets/ has its content hash in its name, so a found one may be cached for a year. */
export function withAssetCaching(pathname: string, response: Response): Response {
  if (!pathname.startsWith("/assets/") || (response.status !== 200 && response.status !== 304)) return response;
  return setHeaders(response, { "Cache-Control": IMMUTABLE });
}

const COMPRESSIBLE = /^(text\/html|application\/json|application\/(?:[\w.+-]+\+)?xml|text\/xml)\b/i;
const MIN_BYTES = 1024;

/** Whether `Accept-Encoding` takes gzip (explicitly, or through `*`) with a q above 0. */
export function acceptsGzip(header: string | null): boolean {
  if (!header) return false;
  let gzip: number | undefined;
  let star: number | undefined;
  for (const part of header.split(",")) {
    const [name, ...params] = part.trim().toLowerCase().split(";");
    const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
    const weight = q ? Number(q.slice(2)) : 1;
    if (name === "gzip" || name === "x-gzip") gzip = weight;
    else if (name === "*") star = weight;
  }
  return (gzip ?? star ?? 0) > 0;
}

/** Gzips an app response when the client takes it and it's HTML, JSON or XML that nobody encoded yet. */
export function compressResponse(request: Request, response: Response): Response {
  const type = response.headers.get("Content-Type") ?? "";
  const length = Number(response.headers.get("Content-Length") ?? NaN);
  if (
    request.method === "HEAD" || !response.body || response.status === 204 || response.status === 206 || response.status === 304 ||
    response.headers.has("Content-Encoding") || /\bno-transform\b/i.test(response.headers.get("Cache-Control") ?? "") ||
    !COMPRESSIBLE.test(type) || length < MIN_BYTES || !acceptsGzip(request.headers.get("Accept-Encoding"))
  ) return response;
  const headers = new Headers(response.headers);
  headers.set("Content-Encoding", "gzip");
  headers.delete("Content-Length");
  const vary = headers.get("Vary");
  if (!vary) headers.set("Vary", "Accept-Encoding");
  else if (!/(^|,)\s*(accept-encoding|\*)\s*(,|$)/i.test(vary)) headers.set("Vary", `${vary}, Accept-Encoding`);
  const etag = headers.get("ETag");
  if (etag && !etag.startsWith("W/")) headers.set("ETag", `W/${etag}`);
  return new Response(response.body.pipeThrough(new CompressionStream("gzip")), { status: response.status, statusText: response.statusText, headers });
}

/** Sets headers, copying the response first when its headers are immutable (e.g. Response.redirect). */
function setHeaders(response: Response, values: Record<string, string>): Response {
  try {
    for (const [name, value] of Object.entries(values)) response.headers.set(name, value);
    return response;
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    const copy = new Response(response.body, response);
    for (const [name, value] of Object.entries(values)) copy.headers.set(name, value);
    return copy;
  }
}
