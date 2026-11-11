// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderWithQueries } from "@/test/dom";
import { headingSkips } from "@/test/headings";
import { fake } from "@/test/fake-fns";

vi.mock("@/features/feed/fns", async (orig) => (await import("@/test/fake-fns")).fakeFns(orig));
vi.mock("@/features/members/fns", async (orig) => (await import("@/test/fake-fns")).fakeFns(orig));
vi.mock("@/features/events/fns", async (orig) => (await import("@/test/fake-fns")).fakeFns(orig));
vi.mock("@/features/auth/fns", async (orig) => (await import("@/test/fake-fns")).fakeFns(orig));
vi.mock("@/app/api", async () => (await import("@/test/fake-fns")).fakeApi);
const resize = vi.hoisted(() => ({ calls: [] as [string, number][], gate: null as Promise<void> | null }));
vi.mock("@/app/resize-image", async (orig) => ({
  ...(await orig<object>()),
  resizeImage: async (file: File, { maxEdge }: { maxEdge: number }) => {
    resize.calls.push([file.name, maxEdge]);
    await resize.gate; // a test can hold every resize back until it opens the gate
    return new File(["small"], file.name.replace(/\.\w+$/, ".webp"), { type: "image/webp" });
  },
}));
vi.mock("@tanstack/react-router", async (orig) => ({ ...(await orig<object>()), ...(await import("@/test/dom")).routerStubs }));

import { Route } from "@/routes/_authenticated/feed";

vi.spyOn(Route, "useRouteContext").mockReturnValue({ user: { id: "u1", name: "Rosa", email: "u1@x.test" } } as never);
const Page = Route.options.component as React.ComponentType;
beforeEach(() => fake.reset());
afterEach(cleanup);

const author = (name: string, slug?: string) => ({ name, line: "Baker, Little Loaf", neighborhood: "Astoria", slug });
const POSTS = [
  {
    id: "p1", kind: "offer", body: "Wholesale is open again.", createdAt: new Date().toISOString(), author: author("Yuna Park", "yuna-park-12"),
    photos: [{ url: "/media/feed/u2/p1-1.jpg", alt: "Loaves on a shelf" }], loves: 23, loved: false, lovedBy: ["Lucía Ferreira", "Aiko Tanaka"],
    replies: [], canDelete: false,
  },
  {
    id: "p2", kind: "ask", body: "Who makes bud vases?", createdAt: new Date().toISOString(), author: author("Rosa"),
    photos: [], loves: 0, loved: false, lovedBy: [],
    replies: [{ id: "r1", author: author("Claire"), body: "Tagging Rosa", createdAt: new Date().toISOString(), canDelete: false }], canDelete: true,
  },
];
const page = { posts: POSTS, next: null, neighborhood: "Astoria", week: 14, mine: { posts: 12, loves: 31 } };
const seed = (viewer = { signedIn: true, member: true, admin: false }): [unknown[], unknown][] => [
  [["viewer"], viewer],
  [["profile", "u1"], { profile: { full_name: "Rosa", status: "approved", catalogue_number: 11, neighborhood: "Astoria", card_color: "rose" }, hasApplication: true }],
  [["feed", "all"], { pages: [page], pageParams: [null] }],
  [["intros", "u1", "Astoria"], []],
  [["events"], []],
  [["rsvps", "u1"], []],
];
const post = (name: RegExp) => screen.getByRole("article", { name });

describe("/feed", () => {
  it("stays out of search", () => {
    const meta = (Route.options.head as () => { meta: Record<string, string>[] })().meta;
    expect(meta).toContainEqual({ name: "robots", content: "noindex" });
  });

  it("is one h1 with no skipped headings, the week's count and her tally", () => {
    const { container } = renderWithQueries(<Page />, seed());
    expect(screen.getAllByRole("heading", { level: 1 }).map((h) => h.textContent)).toEqual(["The feed"]);
    expect(headingSkips(container)).toEqual([]);
    expect(screen.getByText("14 new this week")).toBeTruthy();
    const pass = screen.getByRole("region", { name: "Your member pass" });
    expect(pass.className).toContain("pass--rose");
    expect(within(pass).getByText("Nº 0011")).toBeTruthy();
  });

  it("shows each post's kind, words, photo, author link and who loved it", () => {
    renderWithQueries(<Page />, seed());
    const offer = post(/^Offer from Yuna Park/);
    expect(within(offer).getByText("Wholesale is open again.")).toBeTruthy();
    expect(within(offer).getByRole("img", { name: "Loaves on a shelf" })).toBeTruthy();
    expect(within(offer).getByRole("link", { name: "Yuna Park" }).getAttribute("href")).toBe("/members/yuna-park-12");
    expect(within(offer).getByText("Lucía Ferreira, Aiko Tanaka and 21 others loved this")).toBeTruthy();
    expect(within(offer).queryByRole("button", { name: "Delete this post" })).toBeNull();
    expect(within(post(/^Ask from Rosa/)).getByRole("button", { name: "Delete this post" })).toBeTruthy();
  });

  it("loves a post at once and sends it", async () => {
    renderWithQueries(<Page />, seed());
    fake.results = [new Promise(() => {})];
    const love = within(post(/^Offer from Yuna Park/)).getByRole("button", { name: "Love (23)" });
    fireEvent.click(love);
    await waitFor(() => expect(within(post(/^Offer from Yuna Park/)).getByRole("button", { name: "Love (24)" }).getAttribute("aria-pressed")).toBe("true"));
    expect(fake.calls).toContainEqual(["loveFn", { postId: "p1", on: true }]);
  });

  it("opens a reply box under a post and sends the reply", async () => {
    renderWithQueries(<Page />, seed());
    const ask = post(/^Ask from Rosa/);
    expect(within(ask).getByText("Tagging Rosa")).toBeTruthy();
    fireEvent.click(within(ask).getByRole("button", { name: "Reply (1)" }));
    const box = within(ask).getByRole("textbox", { name: "Reply to Rosa" });
    fireEvent.change(box, { target: { value: "Yes please" } });
    fake.results = [[]];
    fireEvent.click(within(ask).getByRole("button", { name: "Send reply" }));
    await waitFor(() => expect(fake.calls).toContainEqual(["replyFn", { postId: "p2", body: "Yes please" }]));
  });

  it("posts her words as the kind she picked", async () => {
    renderWithQueries(<Page />, seed());
    const send = screen.getByRole("button", { name: "Post" });
    expect((send as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByRole("textbox", { name: "What’s new, Rosa?" }), { target: { value: "  Kiln night Thursday  " } });
    fireEvent.click(screen.getByRole("radio", { name: "Gathering" }));
    fake.results = [{ id: "p3" }, page]; // the post, then the feed's refetch
    fireEvent.click(send);
    await waitFor(() => expect(fake.calls.some(([path]) => path === "/api/feed")).toBe(true));
    const form = fake.calls.find(([path]) => path === "/api/feed")![1] as FormData;
    expect([form.get("kind"), form.get("body"), form.getAll("photo")]).toEqual(["gathering", "Kiln night Thursday", []]);
  });

  it("shrinks each picked photo to 2048px before checking and posting it", async () => {
    Object.assign(URL, { createObjectURL: () => "blob:preview", revokeObjectURL: () => {} }); // jsdom has neither
    resize.calls = [];
    const { container } = renderWithQueries(<Page />, seed());
    const input = container.querySelector<HTMLInputElement>("input[type=file]")!;
    const big = new File([new Uint8Array(8 * 1024 * 1024)], "IMG_0001.jpg", { type: "image/jpeg" }); // over 5 MB as picked
    fireEvent.change(input, { target: { files: [big] } });
    await waitFor(() => expect(screen.getByRole("button", { name: "Post" }).hasAttribute("disabled")).toBe(false));
    expect(resize.calls).toEqual([["IMG_0001.jpg", 2048]]);
    expect(screen.queryByText(/over 5 MB/)).toBeNull();
    fake.results = [{ id: "p3" }, page];
    fireEvent.click(screen.getByRole("button", { name: "Post" }));
    await waitFor(() => expect(fake.calls.some(([path]) => path === "/api/feed")).toBe(true));
    const form = fake.calls.find(([path]) => path === "/api/feed")![1] as FormData;
    expect(form.getAll("photo").map((f) => [(f as File).name, (f as File).type])).toEqual([["IMG_0001.webp", "image/webp"]]);
  });

  it("keeps two overlapping picks to four photos and holds Post until both are ready", async () => {
    Object.assign(URL, { createObjectURL: () => "blob:preview", revokeObjectURL: () => {} });
    let open!: () => void;
    resize.calls = [];
    resize.gate = new Promise((done) => { open = done; });
    const { container } = renderWithQueries(<Page />, seed());
    fireEvent.change(screen.getByRole("textbox", { name: "What’s new, Rosa?" }), { target: { value: "Market day" } });
    const input = container.querySelector<HTMLInputElement>("input[type=file]")!;
    const three = (n: number) => [1, 2, 3].map((i) => new File(["x"], `p${n}-${i}.jpg`, { type: "image/jpeg" }));
    fireEvent.change(input, { target: { files: three(1) } });
    fireEvent.change(input, { target: { files: three(2) } });
    const send = screen.getByRole("button", { name: "Post" });
    await waitFor(() => expect(resize.calls.length).toBe(6));
    expect(send.hasAttribute("disabled")).toBe(true); // her words are there, but the photos aren't yet
    expect(container.querySelector("form[aria-busy=true]")).not.toBeNull();
    open();
    await waitFor(() => expect(send.hasAttribute("disabled")).toBe(false));
    resize.gate = null;
    expect(container.querySelectorAll('img[src="blob:preview"]')).toHaveLength(4);
    expect(screen.getByText("Up to 4 photos a post.")).toBeTruthy();
    expect(container.querySelector("form[aria-busy=true]")).toBeNull();
  });

  it("filters to her own neighborhood", async () => {
    renderWithQueries(<Page />, seed());
    const filters = screen.getByRole("group", { name: "Filter the feed" });
    expect(within(filters).getAllByRole("button").map((b) => b.textContent)).toEqual(["All posts", "Astoria", "Asks & offers", "Gatherings"]);
    fake.results = [{ ...page, posts: [] }];
    fireEvent.click(within(filters).getByRole("button", { name: "Astoria" }));
    await waitFor(() => expect(fake.calls).toContainEqual(["feedFn", { filter: "hood", cursor: null }]));
    expect(await screen.findByText("No posts here yet")).toBeTruthy();
  });

  it("asks before deleting her own post", async () => {
    renderWithQueries(<Page />, seed());
    fake.results = [undefined, page]; // the delete, then the feed's refetch
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    const del = within(post(/^Ask from Rosa/)).getByRole("button", { name: "Delete this post" });
    fireEvent.click(del);
    expect(fake.calls.some(([name]) => name === "deletePostFn")).toBe(false);
    fireEvent.click(del);
    await waitFor(() => expect(fake.calls).toContainEqual(["deletePostFn", { id: "p2" }]));
    confirm.mockRestore();
  });

  it("is locked for anyone not yet welcomed in", () => {
    renderWithQueries(<Page />, seed({ signedIn: true, member: false, admin: false }));
    expect(screen.getByText("Unlocks once you’re welcomed in")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Post" })).toBeNull();
    expect(screen.queryByRole("article")).toBeNull();
    expect(fake.calls.some(([name]) => name === "feedFn")).toBe(false);
  });
});
