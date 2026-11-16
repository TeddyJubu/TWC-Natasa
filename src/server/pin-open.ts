// What the private-preview PIN (site-pin.ts) leaves open, so anyone can answer a form before launch: the form pages,
// sign-in (where /join leads), the posts they make and the few server functions they call from the browser. Every
// other page, API, upload and server function still needs the PIN. No imports: vite.config.ts reads PUBLIC_FNS too.

/** Form pages and sign-in, matched exactly; `/f/<slug>` and `/f/<slug>/thanks` by prefix. */
export const OPEN_PAGES = new Set(["/join", "/review", "/contact", "/partnerships", "/spotlight", "/auth", "/reset-password", "/verified"]);
/** The body-taking routes those pages post to; `/api/forms/<slug>` and Better Auth's `/api/auth/*` by prefix. */
export const OPEN_APIS = new Set(["/api/applications", "/api/contact", "/api/partnerships", "/api/review", "/api/spotlight"]);
const OPEN_PREFIXES = ["/f/", "/api/forms/", "/api/auth/", "/assets/"];

/**
 * The server functions those pages call in the browser (a client-side navigation runs their loaders). In a build each
 * gets the fixed id `open-<name>` (vite.config.ts, `serverFns.generateFunctionId`); every other function keeps its
 * default sha256 id, which no `open-` path can name. Keyed by file + export, so a namesake elsewhere stays shut.
 */
export const PUBLIC_FNS = new Set([
  "src/features/forms/fns.ts--openFormFn",
  "src/features/forms-state/fns.ts--publicFormStateFn",
  "src/features/form-copy/fns.ts--publicFormCopyFn",
  "src/features/member-links/fns.ts--openReviewFn",
  "src/features/member-links/fns.ts--openSpotlightFn",
  "src/features/applications/fns.ts--applicantFn",
]);
const fnName = (entry: string) => entry.slice(entry.indexOf("--") + 2);
const OPEN_FNS = new Set([...PUBLIC_FNS].map((e) => `/_serverFn/open-${fnName(e)}`));

/** vite.config.ts: the fixed id for a public function, undefined (the default id) for the rest. */
// The compiler names each handler `<export>_createServerFn_handler`.
export const publicFnId = ({ filename, functionName }: { filename: string; functionName: string }) => {
  const name = functionName.replace(/_createServerFn_handler$/, "");
  return PUBLIC_FNS.has(`${filename.replace(/^\//, "")}--${name}`) ? `open-${name}` : undefined;
};

/** True when this path needs no PIN. A trailing slash is ignored (it only redirects). */
export function isPinOpen(pathname: string): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return OPEN_PAGES.has(path) || OPEN_APIS.has(path) || OPEN_FNS.has(path) || OPEN_PREFIXES.some((p) => path.startsWith(p));
}
