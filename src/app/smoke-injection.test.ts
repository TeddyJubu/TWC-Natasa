import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { injectionProblems, KNOWN_HOSTS, STATIC_HOSTS, STATIC_SCRIPTS } from "../../scripts/smoke-cutover";

// GAP-1: an edge-injected SEO-spam script appended before </body> must fail the smoke, on the app's pages (nonce CSP)
// and on pages with no nonce (the PIN page, the apex's static coming-soon page).
const csp = "default-src 'self'; script-src 'self' 'nonce-n0Nc3'; object-src 'none'";
const injected = `<script>(function(){ var h6=document.createElement('h6');
  h6.innerHTML='Betaflight <a href="https://betaflight.uk.com">x</a> <a href=\\"https://convertmaister.com/\\">y</a>';
  document.body.appendChild(h6);})();</script>`;

describe("smoke-cutover injectionProblems", () => {
  it("passes the app's own page: nonce'd bootstrap, assets, JSON-LD and known links", () => {
    const html = `<link rel="stylesheet" href="/assets/app.css"><script nonce="n0Nc3">$_TSR={}</script>
      <script type="module" src="/assets/main.js"></script><script type="application/ld+json">{"@context":"https://schema.org"}</script>
      <a href="https://www.instagram.com/x">ig</a><a href="https://natasatuohy.com">n</a>
      <a href="https://new.thewomenscollective.club/about">a</a><a href="mailto:hi@x.test">m</a>
      <svg xmlns="http://www.w3.org/2000/svg"></svg>`;
    expect(injectionProblems(html, csp)).toEqual([]);
  });

  it("passes a static page with no scripts and no nonce", () => {
    expect(injectionProblems(`<a href="/join">Join</a>`, null)).toEqual([]);
  });

  it("flags the injected script and both spam hosts, with or without a nonce in the CSP", () => {
    for (const header of [csp, null]) {
      const problems = injectionProblems(`<main>hi</main>${injected}</body>`, header);
      expect(problems).toHaveLength(3);
      expect(problems.join("\n")).toMatch(/inline <script> is not the app's bootstrap/);
      expect(problems.join("\n")).toMatch(/betaflight\.uk\.com/);
      expect(problems.join("\n")).toMatch(/convertmaister\.com/);
    }
  });

  it("flags an inline script on a page whose CSP has no nonce, even one that looks like ours", () => {
    expect(injectionProblems(`<script nonce="n0Nc3">a()</script>`, null)).toHaveLength(1);
  });

  it("flags an external script, an iframe and a form to an unknown host, once per host", () => {
    const html = `<script src="https://cdn.evil.test/a.js"></script><iframe src="https://evil.test/f"></iframe>
      <form action="https://collect.example/x"></form><img src="https://evil.test/p.gif">`;
    expect(injectionProblems(html, csp)).toEqual([
      "links to unknown host cdn.evil.test",
      "links to unknown host evil.test",
      "links to unknown host collect.example",
    ]);
  });

  it("counts a subdomain of a known host as known, not a look-alike, and takes extra hosts", () => {
    expect(injectionProblems(`<a href="https://tiles.openfreemap.org/x">t</a>`, csp)).toEqual([]);
    expect(injectionProblems(`<a href="https://thewomenscollective.club.evil.test/">x</a>`, csp)).toHaveLength(1);
    expect(injectionProblems(`<a href="https://fonts.example/">f</a>`, csp, ["fonts.example"])).toEqual([]);
  });

  it("flags protocol-relative links and scripts to an unknown host", () => {
    expect(injectionProblems(`<a href="//evil.test/">x</a><script src="//cdn.evil.test/a.js"></script>`, csp)).toEqual([
      "links to unknown host evil.test",
      "links to unknown host cdn.evil.test",
    ]);
    expect(injectionProblems(`<a href="//new.thewomenscollective.club/about">a</a><a href="/join">j</a>`, csp)).toEqual([]);
  });

  it("lets a no-nonce static page keep its own listed inline scripts, by body hash, and nothing else", () => {
    const body = "  console.log('ours')\n";
    const hash = createHash("sha256").update(body.trim()).digest("hex");
    expect(injectionProblems(`<script>${body}</script>`, null, KNOWN_HOSTS, [hash])).toEqual([]);
    expect(injectionProblems(`<script>${body}</script>${injected}`, null, KNOWN_HOSTS, [hash])).toHaveLength(3);
    // A nonce page's scripts must carry the nonce; a listed hash doesn't excuse them.
    expect(injectionProblems(`<script>${body}</script>`, csp, KNOWN_HOSTS, [hash])).toHaveLength(1);
    // An unclosed injected script still counts.
    expect(injectionProblems(`<script>${body}</script><script>evil()`, null, KNOWN_HOSTS, [hash])).toHaveLength(1);
  });

  // The apex's old static pages, from the local legacy snapshot (gitignored, so skipped where it's missing). The
  // snapshot was saved through Cloudflare, so index.html also carries Cloudflare's JS-detections bootstrap
  // (`__CF$cv$params`, a new ray id each request); that one is the edge's, not the page's, and stays flagged.
  const legacy = (name: string) => `${import.meta.dirname}/../../.migration/legacy/site/${name}`;
  const pageOf = (name: string) =>
    readFileSync(legacy(name), "utf8").replace(/<script>[^<]*__CF\$cv\$params[\s\S]*?<\/script>/, "");
  for (const name of ["index.html", "404.html"]) {
    it.skipIf(!existsSync(legacy(name)))(`passes the apex's static ${name}, and flags the injection appended to it`, () => {
      const allowed = [...KNOWN_HOSTS, ...STATIC_HOSTS];
      const html = pageOf(name);
      expect(injectionProblems(html, null, allowed, STATIC_SCRIPTS)).toEqual([]);
      const problems = injectionProblems(html.replace("</body>", `${injected}</body>`), null, allowed, STATIC_SCRIPTS);
      expect(problems).toHaveLength(3);
      expect(problems.join("\n")).toMatch(/betaflight\.uk\.com/);
    });
  }
});
