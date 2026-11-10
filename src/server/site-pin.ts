// The private-preview gate: while SITE_PIN is set in the server's environment, every request (pages, /api, /media and
// static files; server.mjs runs it first) needs the PIN cookie or gets the PIN page. The PIN itself never leaves the
// environment: the cookie holds its hash, and a new PIN signs everyone out of the preview. Unset, the site is open.
import { createHash, timingSafeEqual } from "node:crypto";
import { clientIp, rateLimit } from "./request";

export const PIN_COOKIE = "twc_pin";
export const PIN_PATH = "/__pin";
/** Answered without the PIN: the icons the PIN page shows, and the deploy's health check. */
const OPEN = new Set(["/favicon.ico", "/favicon.png", "/apple-touch-icon.png", "/healthz"]);
const MAX_AGE = 60 * 60 * 24 * 30;
// ponytail: 10 tries per client IP per 10 minutes, in memory (see rateLimit).
const tries = rateLimit(10, 10 * 60 * 1000);

const token = (pin: string) => createHash("sha256").update(`twc-site-pin:${pin}`).digest("hex");
const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const cookieOf = (request: Request, name: string) =>
  request.headers.get("cookie")?.split(/;\s*/).find((c) => c.startsWith(`${name}=`))?.slice(name.length + 1);
/** Where to go after the PIN: a path on this site, never another origin (`//x`, `/\x`) or the PIN form itself. */
const safeNext = (v: unknown) =>
  typeof v === "string" && /^\/(?![/\\])[^\s]*$/.test(v) && v.length <= 2000 && !v.startsWith(PIN_PATH) ? v : "/";
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** The PIN page's response, or null to let the request through. */
export async function pinGate(request: Request, pin = process.env.SITE_PIN): Promise<Response | null> {
  if (!pin) return null;
  const url = new URL(request.url);
  if (OPEN.has(url.pathname)) return null;
  const cookie = cookieOf(request, PIN_COOKIE);
  if (cookie && same(cookie, token(pin))) return null;

  if (url.pathname === PIN_PATH && request.method === "POST") {
    // A PIN form is tiny: refuse anything bigger, or of unknown size, before reading it.
    const length = Number(request.headers.get("content-length") ?? NaN);
    if (!(length <= 4096)) return page("/", "Please try again.", 413);
    const form = await request.formData().catch(() => null);
    const next = safeNext(form?.get("next"));
    if (!tries(clientIp(request.headers))) return page(next, "Too many tries. Please wait a few minutes.", 429);
    const given = form?.get("pin");
    if (typeof given !== "string" || !same(token(given.trim()), token(pin))) return page(next, "That PIN isn’t right.", 401);
    const secure = url.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
    return new Response(null, {
      status: 303,
      headers: {
        Location: next,
        "Set-Cookie": `${PIN_COOKIE}=${token(pin)}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`,
        "Cache-Control": "no-store",
      },
    });
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("This site is private.", { status: 401, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
  }
  return page(url.pathname + url.search, null, 401);
}

/** A self-contained page (no scripts, no app assets) that posts the PIN and returns to `next`. */
function page(next: string, error: string | null, status: number): Response {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow">
<title>Private preview — The Women’s Collective</title>
<link rel="icon" href="/favicon.ico" sizes="48x48"><link rel="icon" href="/favicon.png" type="image/png" sizes="192x192"><link rel="apple-touch-icon" href="/apple-touch-icon.png">
<style>
*{box-sizing:border-box;margin:0}
body{min-height:100vh;display:grid;place-items:center;padding:24px 16px;background:#e5ebf1;color:#1c2c5e;font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
body::before{content:"";position:fixed;inset:0 0 auto;height:8px;background:repeating-linear-gradient(-45deg,#d23b2e 0 14px,#fbfaf6 14px 22px,#1c2c5e 22px 36px,#fbfaf6 36px 44px)}
main{width:min(380px,100%);padding:32px 28px;border-radius:14px;background:#fbfaf6;box-shadow:0 24px 40px -28px rgb(28 44 94/.6),0 1px 2px rgb(28 44 94/.12);text-align:center}
img{width:64px;height:64px;border-radius:14px}
h1{margin-top:16px;font:400 28px/1.1 Georgia,"Times New Roman",serif;letter-spacing:-.01em}
p{margin-top:8px;font-size:14.5px;color:#4a5578}
form{display:grid;gap:10px;margin-top:22px}
label{font:500 11px/1 ui-monospace,Menlo,monospace;letter-spacing:.14em;text-transform:uppercase;color:#4a5578;text-align:left}
input{width:100%;min-height:46px;padding:0 14px;border:0;border-radius:12px;background:#fff;box-shadow:inset 0 0 0 1px rgb(28 44 94/.3);font:inherit;color:inherit}
input:focus{outline:2px solid #1c2c5e;outline-offset:2px}
button{min-height:46px;border:0;border-radius:999px;background:#d23b2e;color:#fff;font:600 15px/1 inherit;cursor:pointer}
button:focus-visible{outline:2px solid #1c2c5e;outline-offset:2px}
.err{margin-top:14px;color:#b3261e;font-weight:600}
</style>
</head>
<body>
<main>
<img src="/favicon.png" alt="The Women’s Collective">
<h1>Private preview</h1>
<p>The Women’s Collective’s new site isn’t open yet. Enter the PIN to come in.</p>
${error ? `<p class="err" role="alert">${esc(error)}</p>` : ""}
<form method="post" action="${PIN_PATH}">
<input type="hidden" name="next" value="${esc(next)}">
<label for="pin">PIN</label>
<input id="pin" name="pin" type="password" autocomplete="current-password" required autofocus${error ? ' aria-invalid="true"' : ""}>
<button type="submit">Enter</button>
</form>
</main>
</body>
</html>`;
  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" },
  });
}
