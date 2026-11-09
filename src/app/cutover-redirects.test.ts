import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { NEW, pageRows } from "../../scripts/smoke-cutover";

// migration/caddy-twc-redirects.caddy is what gets pasted into the live Caddyfile; it must match the
// owner's map in migration/redirects.md, row for row, tidy and `.html`.
const caddy = readFileSync("migration/caddy-twc-redirects.caddy", "utf8");
const md = readFileSync("migration/redirects.md", "utf8");

function snippet(name: string): string {
  const m = caddy.match(new RegExp(`^\\(${name}\\) \\{\\n([\\s\\S]*?)^\\}`, "m"));
  if (!m) throw new Error(`no (${name}) snippet`);
  return m[1];
}

/** old path → `{ to, status, block }` for every `@name … path …` + `redir @name to status` pair. */
function redirects(body: string) {
  const blocks = new Map<string, string>();
  for (const m of body.matchAll(/^\t@(\w+) \{\n([\s\S]*?)^\t\}/gm)) blocks.set(m[1], m[2]);
  for (const m of body.matchAll(/^\t@(\w+) (path [^\n]+)/gm)) blocks.set(m[1], m[2]);
  const out = new Map<string, { to: string; status: string; block: string }>();
  for (const m of body.matchAll(/^\tredir @(\w+) (\S+) (\S+)/gm)) {
    const block = blocks.get(m[1]) ?? "";
    for (const p of block.match(/\bpath ([^\n]+)/)?.[1].trim().split(/\s+/) ?? []) {
      out.set(p, { to: m[2], status: m[3], block });
    }
  }
  return out;
}

describe("vps-cutover Caddy snippet", () => {
  const apex = redirects(snippet("twc_apex_cutover"));
  const rows = pageRows(md);

  it("covers every page row, both URLs, one 301 hop, GET/HEAD only", () => {
    expect(rows.length).toBe(15);
    for (const [tidy, html, to] of rows) {
      for (const p of [tidy, html]) {
        const r = apex.get(p);
        expect(r, p).toMatchObject({ to: `${NEW}${to}`, status: "301" });
        // A stale form POSTing to /message-sent.html must still reach the forms service.
        expect(r?.block, p).toContain("method GET HEAD");
      }
    }
  });

  it("keeps the apex homepage, sends /apply straight to the app and never moves /f/* yet", () => {
    expect(apex.has("/")).toBe(false);
    expect(apex.get("/index.html")).toMatchObject({ to: "/", status: "301" });
    expect(apex.get("/apply")?.to).toBe(`${NEW}/join`);
    expect([...apex.keys()].some((p) => p.startsWith("/f/"))).toBe(false);
  });

  it("sends join.*/members.* /join to the app but leaves POSTs and /join/thanks on intake", () => {
    const r = redirects(snippet("twc_members_cutover"));
    expect(r.get("/join")).toMatchObject({ to: `${NEW}/join`, status: "301" });
    expect(r.get("/join")?.block).toContain("members.thewomenscollective.club");
    expect(r.get("/join")?.block).toContain("method GET HEAD");
    expect(r.has("/join/thanks") || r.has("/join/*")).toBe(false);
  });

  it("keeps the review token's query on both members hosts", () => {
    for (const name of ["twc_members_cutover", "twc_nbwc_cutover"]) {
      const r = redirects(snippet(name)).get("/review");
      expect(r?.to, name).toBe(`${NEW}{uri}`);
      expect(r?.block, name).toContain("method GET HEAD");
    }
  });

  // All-method (no GET/HEAD matcher): whole admin/crm hosts become /admin; no form POST to keep.
  it("admin and crm snippets 301 every method to /admin", () => {
    for (const name of ["twc_admin_cutover", "twc_crm_cutover"]) {
      const body = snippet(name);
      expect(body, name).toContain(`redir ${NEW}/admin 301`);
      expect(body, name).not.toContain("method GET HEAD");
    }
  });
});
