// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/supabase", async () => (await import("@/test/fake-supabase")).fakeSupabaseModule);

import { Route } from "@/routes/__root";

type Tag = Record<string, string>;
const head = (pathnames: string[]) =>
  (Route.options.head as (ctx: unknown) => { meta: Tag[]; links: Tag[] })({
    matches: pathnames.map((pathname) => ({ pathname })),
  });
const metaContent = (meta: Tag[], key: string) =>
  meta.find((m) => m.property === key || m.name === key)?.content;

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("root head", () => {
  it("sets a real default title and description, and no @Lovable twitter:site", () => {
    vi.stubEnv("VITE_SITE_URL", "");
    const { meta } = head(["/"]);
    expect(meta.find((m) => "title" in m)?.title).toBe("The Women’s Collective — Find Your People in Queens");
    expect(metaContent(meta, "description")).toBe(
      "A community for women founders, entrepreneurs, creatives, freelancers, professionals, and neighbors across Western Queens.",
    );
    expect(metaContent(meta, "twitter:site")).toBeUndefined();
  });

  it("emits no canonical, og:url or og:image when VITE_SITE_URL is unset", () => {
    vi.stubEnv("VITE_SITE_URL", "");
    const { meta, links } = head(["/", "/members"]);
    expect(links.find((l) => l.rel === "canonical")).toBeUndefined();
    expect(metaContent(meta, "og:url")).toBeUndefined();
    expect(metaContent(meta, "og:image")).toBeUndefined();
  });

  it("emits nothing when VITE_SITE_URL is invalid", () => {
    vi.stubEnv("VITE_SITE_URL", "thewomenscollective.nyc");
    const { meta, links } = head(["/", "/members"]);
    expect(links.find((l) => l.rel === "canonical")).toBeUndefined();
    expect(metaContent(meta, "og:url")).toBeUndefined();
    expect(metaContent(meta, "og:image")).toBeUndefined();
  });

  it("emits absolute canonical, og:url and og:image for the current path when VITE_SITE_URL is set", () => {
    vi.stubEnv("VITE_SITE_URL", "https://example.com/");
    const { meta, links } = head(["/", "/members"]);
    expect(links.find((l) => l.rel === "canonical")?.href).toBe("https://example.com/members");
    expect(metaContent(meta, "og:url")).toBe("https://example.com/members");
    const image = metaContent(meta, "og:image");
    expect(image).toMatch(/^https:\/\/example\.com\/.+hero.*\.jpg$/);
    expect(metaContent(meta, "twitter:site")).toBeUndefined();
  });
});
