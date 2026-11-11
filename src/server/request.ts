// Helpers for the server routes that take a request body (src/routes/api/{images,neighborhood-logos,applications,contact}.ts).
import { AccessError } from "./guard";

/**
 * The visitor's address. The server sits behind Cloudflare → Caddy, so the socket address is always Caddy's:
 * cf-connecting-ip first, else the first x-forwarded-for entry, else "unknown" (one shared bucket).
 */
export function clientIp(headers: Headers): string {
  return headers.get("cf-connecting-ip")?.trim() || headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

/** A rate limiter: `allow(key)` counts one request; `size` is how many keys it is holding. */
export type Limiter = ((ip: string, now?: number) => boolean) & { readonly size: number };

/**
 * A per-client-IP limit: the returned `allow(ip)` is true while `ip` has made fewer than `limit` requests in the
 * last `windowMs` (and counts this one). Each endpoint makes its own, so the counts are separate. Once it holds
 * `maxKeys` keys it drops every key with nothing left in the window, so rotating addresses can't grow it forever.
 */
export function rateLimit(limit: number, windowMs: number, maxKeys = 10_000): Limiter {
  // ponytail: in-memory, per process — the server is one process. Restarting it resets the counts; move this to
  // SQLite (or Caddy) if it ever runs as several processes.
  const recent = new Map<string, number[]>();
  // The next size that triggers a sweep: at least maxKeys, and twice what a sweep kept, so a full window of live
  // keys isn't swept on every request.
  let sweepAt = maxKeys;
  const allow = (ip: string, now = Date.now()) => {
    if (recent.size >= sweepAt) {
      for (const [key, times] of recent) if (now - times[times.length - 1] >= windowMs) recent.delete(key);
      sweepAt = Math.max(maxKeys, recent.size * 2);
    }
    const kept = (recent.get(ip) ?? []).filter((t) => now - t < windowMs);
    if (kept.length >= limit) {
      recent.set(ip, kept);
      return false;
    }
    recent.set(ip, [...kept, now]);
    return true;
  };
  return Object.defineProperty(allow, "size", { get: () => recent.size }) as Limiter;
}

/** Refuses a body over `max` bytes, or of unknown size, from its Content-Length alone (nothing is read). */
export function checkSize(request: Request, max: number): void {
  const length = request.headers.get("content-length");
  if (length === null || !/^\d+$/.test(length)) throw new HttpError("Please send the upload again.", 411);
  if (Number(length) > max) throw new HttpError("That’s too large to send.", 413);
}

/** A refusal with an HTTP status outside AccessError's set. */
export class HttpError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/** A database or unexpected error as a message a member can act on; never SQL or internals. */
export function publicError(error: unknown): Error {
  if (error instanceof AccessError || error instanceof HttpError) return error;
  const message = (error as Error | null)?.message ?? "";
  if (/FOREIGN KEY constraint/.test(message)) return new AccessError("That neighborhood isn’t one we know.", 400);
  if (/UNIQUE constraint/.test(message)) return new AccessError("That already exists.", 400);
  if (/CHECK constraint/.test(message)) return new AccessError("Some details aren’t valid. Check the lengths and the website (http:// or https://).", 400);
  console.error("[server]", error);
  return new Error("Something went wrong. Please try again.");
}

/** Runs an endpoint: its result as JSON (204 when there is none), any error as `{ error }` with its status. */
export async function respond(run: () => unknown): Promise<Response> {
  try {
    const result = await run();
    return result === undefined ? new Response(null, { status: 204 }) : Response.json(result);
  } catch (error) {
    const safe = publicError(error);
    const status = safe instanceof AccessError || safe instanceof HttpError ? safe.status : 500;
    return Response.json({ error: safe.message }, { status });
  }
}

/** Reads a multipart body (call only after checkSize and the guard). */
export async function readForm(request: Request): Promise<FormData> {
  try {
    return await request.formData();
  } catch {
    throw new AccessError("Invalid upload.", 400);
  }
}

/** A file field's bytes. */
export async function fileBytes(form: FormData, name = "file"): Promise<Uint8Array> {
  const file = form.get(name);
  if (!(file instanceof Blob)) throw new AccessError("Invalid upload.", 400);
  return new Uint8Array(await file.arrayBuffer());
}
