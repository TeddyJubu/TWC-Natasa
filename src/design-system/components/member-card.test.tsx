import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemberCard, type MemberProfile } from "./member-card";
import { formatCatalogueNumber } from "../lib/utils";

const member: MemberProfile = {
  id: "m1",
  name: "Test Member",
  role: "Founder",
  business: "Studio",
  neighborhood: "Astoria",
  specialty: "Design",
  bio: "Bio",
  lookingFor: "Peers",
  image: "/x.jpg",
  imageAlt: "Portrait",
};

const render = (el: React.ReactElement) => renderToStaticMarkup(el);
const classTokens = (html: string) => [...html.matchAll(/class="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/));

describe("MemberCard tone", () => {
  it("sets --hood and uses the static hood utilities", () => {
    const html = render(
      <MemberCard member={member} variant="catalogue" tone={{ color: "#2f9dff" }} style={{ marginTop: 4 }} />,
    );
    expect(html).toContain("--hood:#2f9dff");
    expect(html).toContain("margin-top:4px");
    const tokens = classTokens(html);
    for (const cls of ["bg-(--hood)", "text-(--hood)", "border-(--hood)"]) expect(tokens).toContain(cls);
  });

  it("puts --hood and the caller's style on the <article> itself", () => {
    const html = render(
      <MemberCard member={member} variant="catalogue" tone={{ color: "#2f9dff" }} style={{ opacity: 0.5 }} />,
    );
    const articleTag = html.match(/<article\b[^>]*>/)?.[0] ?? "";
    expect(articleTag).toMatch(/style="[^"]*--hood:#2f9dff/);
    expect(articleTag).toMatch(/style="[^"]*opacity:0\.5/);
  });

  it("falls back to neutral styling without a tone", () => {
    const html = render(<MemberCard member={member} variant="catalogue" />);
    expect(html).not.toContain("--hood");
    expect(classTokens(html)).toContain("bg-surface");
    expect(classTokens(html).some((c) => c.toLowerCase().includes("astoria"))).toBe(false);
  });
});

describe("member-card source", () => {
  it("contains no neighborhood names or slugs", () => {
    const src = readFileSync(new URL("./member-card.tsx", import.meta.url), "utf8");
    const terms = [
      "Long Island City", "Astoria", "Sunnyside", "Jackson Heights", "Elmhurst", "Forest Hills", "Rego Park",
      "lic", "long-island-city", "jackson-heights", "forest-hills", "rego-park",
    ];
    for (const term of terms) expect(src).not.toMatch(new RegExp(`\\b${term}\\b`, "i"));
  });
});

describe("catalogue number", () => {
  const label = (html: string) => html.match(/aria-label="Catalogue number (\d+)"/)?.[1];
  it("prefers the prop", () => {
    const html = render(<MemberCard member={{ ...member, catalogueNumber: 9 }} variant="catalogue" catalogueNumber={3} />);
    expect(label(html)).toBe("3");
    expect(html).toContain(">03<");
  });
  it("falls back to member.catalogueNumber", () => {
    const html = render(<MemberCard member={{ ...member, catalogueNumber: 9 }} variant="catalogue" />);
    expect(html).toContain(">09<");
  });
  it("defaults to 01", () => {
    expect(render(<MemberCard member={member} variant="catalogue" />)).toContain(">01<");
  });
});

describe("formatCatalogueNumber", () => {
  it("zero-pads to two digits", () => {
    expect(formatCatalogueNumber(7)).toBe("07");
    expect(formatCatalogueNumber(12)).toBe("12");
    expect(formatCatalogueNumber(123)).toBe("123");
    expect(formatCatalogueNumber(0)).toBe("00");
  });
});
