import { describe, expect, it } from "vitest";
import { injectionProblems } from "../../scripts/smoke-cutover";

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
});
