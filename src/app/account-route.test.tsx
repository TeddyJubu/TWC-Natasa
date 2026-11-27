// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import type { MemberProfile } from "@/index";
import { demoMembers } from "@/showcase/demo-members";
import type { Profile } from "@/features/members/queries";
import { NEIGHBORHOOD_SEED } from "@/features/neighborhoods/queries";
import { chooseValue, renderWithQueries, selectOptions } from "@/test/dom";
import { restoreTz, setTz } from "@/test/tz";
import { fake } from "@/test/fake-fns";

// The page's unsaved-changes blocker: the options it registers, last render first.
type BlockerOpts = { shouldBlockFn: (a: { current: { pathname: string }; next: { pathname: string } }) => Promise<boolean>; disabled?: boolean; enableBeforeUnload?: boolean };
const blocker = vi.hoisted(() => ({ opts: undefined as BlockerOpts | undefined }));
const auth = vi.hoisted(() => ({ listAccounts: vi.fn(), changePassword: vi.fn(), deleteUser: vi.fn(), signOut: vi.fn() }));

vi.mock("@/features/members/fns", async (orig) => (await import("@/test/fake-fns")).fakeFns(orig));
vi.mock("@/features/events/fns", async (orig) => (await import("@/test/fake-fns")).fakeFns(orig));
vi.mock("@/features/cal/fns", async (orig) => (await import("@/test/fake-fns")).fakeFns(orig));
vi.mock("@/features/auth/fns", async (orig) => (await import("@/test/fake-fns")).fakeFns(orig));
vi.mock("@/app/api", async () => (await import("@/test/fake-fns")).fakeApi);
vi.mock("@/app/auth-client", () => ({ getAuthClient: async () => auth }));
vi.mock("@tanstack/react-router", async (orig) => ({
  ...(await orig<object>()), ...(await import("@/test/dom")).routerStubs,
  useBlocker: (opts: BlockerOpts) => { blocker.opts = opts; return { status: "idle" }; },
}));

import { Route } from "@/routes/_authenticated/account";

vi.spyOn(Route, "useRouteContext").mockReturnValue({ user: { id: "u1", email: "rosa@example.test" } } as never);
const Page = Route.options.component as React.ComponentType;
beforeEach(() => {
  // Hide the one-time “You’re in” panel unless a test clears storage on purpose.
  localStorage.setItem("twc-youre-in:v1:u1", "1");
  auth.listAccounts.mockResolvedValue({ data: [{ providerId: "credential" }], error: null });
});
afterEach(() => {
  cleanup();
  fake.reset();
  vi.clearAllMocks();
  blocker.opts = undefined;
});

const base: Profile = {
  id: "u1", full_name: "Rosa Diaz", role_title: "Founder", business: "Diaz Bakery", neighborhood: "Astoria",
  specialty: "Food", bio: "", looking_for: "", website: "", avatar_path: null, business_logo_url: null, directory_visible: false,
  public_profile: false, status: "approved", catalogue_number: 27, member_since: "2026-01-05T12:00:00Z", card_color: "mustard",
  created_at: "", updated_at: "",
};

const card = (name: string, n: number): MemberProfile => ({
  id: `u-${n}`, name, role: "Maker", business: `${name} Co`, neighborhood: "Astoria", specialty: "",
  bio: "", lookingFor: "", image: "x.jpg", imageAlt: `Portrait of ${name}`, catalogueNumber: n,
});

const viewer = (admin = false) => [["viewer"], { signedIn: true, member: true, admin }] as [unknown[], unknown];

function renderAccount(
  over: Partial<Profile> = {}, intros: MemberProfile[] = [], events: unknown[] = [], admin = false,
  extra: [unknown[], unknown][] = [], logoUrl?: string,
) {
  const profile = { ...base, ...over };
  return renderWithQueries(<Page />, [
    viewer(admin),
    [["profile", "u1"], { profile, avatarUrl: undefined, logoUrl }],
    [["events"], events],
    [["rsvps", "u1"], []],
    [["rsvps", "u1", "plans"], []],
    [["booking", "u1"], null],
    [["intros", "u1", profile.neighborhood], intros],
    ...extra,
  ]);
}

const button = (name: RegExp | string) => screen.getByRole("button", { name }) as HTMLButtonElement;
const save = () => button(/save changes/i);
/** The save bar holds no buttons until something changed. */
const noSave = () => screen.queryByRole("button", { name: /save changes/i }) === null;
const status = () => screen.getByRole("status").textContent;
const editDirectoryCard = () => fireEvent.click(button("Edit directory card"));

describe("/account", () => {
  describe("business logo", () => {
    const png = () => new File(["x"], "logo.PNG", { type: "image/png" });

    it("is optional: an upload stores it in her own avatars folder and points her profile at it", async () => {
      renderAccount();
      expect(screen.queryByRole("button", { name: /remove logo/i })).toBeNull();
      fake.results = [{ ...base, business_logo_url: "u1/logo-1.png" }];
      fireEvent.change(screen.getByLabelText(/add business logo/i), { target: { files: [png()] } });
      await waitFor(() => expect(fake.calls.map(([c]) => c)).toContain("/api/images"));
      const form = fake.calls.find(([c]) => c === "/api/images")![1] as FormData;
      expect([form.get("kind"), (form.get("file") as File).name]).toEqual(["logo", "logo.PNG"]);
    });

    it("rejects a GIF or a file over 5 MB before any upload", async () => {
      renderAccount();
      const input = screen.getByLabelText(/add business logo/i);
      fireEvent.change(input, { target: { files: [new File(["x"], "a.gif", { type: "image/gif" })] } });
      expect((await screen.findByRole("alert")).textContent).toMatch(/JPG, PNG or WebP/);
      const big = new File(["x"], "big.png", { type: "image/png" });
      Object.defineProperty(big, "size", { value: 5 * 1024 * 1024 + 1 });
      fireEvent.change(input, { target: { files: [big] } });
      await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/over 5 MB/));
      expect(fake.calls.filter(([c]) => c === "/api/images")).toEqual([]);
    });

    it("shows her logo with a Remove button that clears it and deletes the file", async () => {
      renderAccount({ business_logo_url: "u1/logo-1.png" }, [], [], false, [], "https://club.test/media/avatars/u1/logo-1.png");
      expect((screen.getByRole("img", { name: "Diaz Bakery logo" }) as HTMLImageElement).src).toBe("https://club.test/media/avatars/u1/logo-1.png");
      fake.results = [{ ...base, business_logo_url: null }];
      fireEvent.click(screen.getByRole("button", { name: /remove logo/i }));
      await waitFor(() => expect(fake.calls).toContainEqual(["removeLogoFn"]));
    });
  });

  it("announces loading with role=status", () => {
    fake.results = [new Promise(() => {}) as never];
    renderWithQueries(<Page />, [viewer()]);
    expect(screen.getByRole("status")).toBeTruthy();
    // The landmark exists while loading, so route focus has a target (T28).
    expect(screen.getByRole("main").id).toBe("main");
  });

  it("the not-found screen sits in main#main too", async () => {
    fake.results = [null];
    renderWithQueries(<Page />, [viewer()]);
    expect(await screen.findByText("Profile Not Found")).toBeTruthy();
    expect(screen.getByRole("main").id).toBe("main");
  });

  it("shows an Admin tab, linking /admin, to admins only", () => {
    renderAccount({}, [], [], true);
    fireEvent.click(screen.getByRole("button", { name: /account menu/ }));
    const nav = screen.getByRole("navigation", { name: "My account" });
    expect(within(nav).getByRole("link", { name: "Admin" }).getAttribute("href")).toBe("/admin");
    expect(within(nav).getByRole("link", { name: "Admin" }).getAttribute("aria-current")).toBeNull();
    cleanup();
    renderAccount();
    expect(screen.queryByRole("link", { name: "Admin" })).toBeNull();
  });

  it("shows a declined application as declined, not in review", () => {
    renderAccount({ status: "declined", catalogue_number: null });
    expect(screen.getAllByText(/not approved/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/in review/i)).toBeNull();
    expect(screen.queryByText(/application pending/i)).toBeNull();
    expect(screen.queryByText(/being reviewed/i)).toBeNull();
    expect(screen.getByText("Application not approved")).toBeTruthy();
    expect(screen.getByText(/weren’t able to offer you a membership/i)).toBeTruthy();
  });

  it("a declined account sees only the head and Account settings: nothing to fill in, nothing promised", () => {
    renderAccount({ status: "declined", catalogue_number: null, neighborhood: null });
    const main = screen.getByRole("main");
    expect([...main.querySelectorAll("section[id]")].map((s) => s.id)).toEqual(["profile", "settings"]);
    expect(main.textContent).not.toMatch(/welcomed in|once you’re approved|once your membership|this time|you’ll meet|save your seat|how neighbors see you|choose your neighborhood/i);
    // No map, card, words or visibility to edit, and no card to preview.
    expect(screen.queryByRole("switch")).toBeNull();
    expect(screen.queryByRole("button", { name: /^edit|^add|view directory card/i })).toBeNull();
    expect(screen.queryByRole("region", { name: "Membership" })).toBeNull();
    const contact = screen.getAllByRole("link", { name: /contact us/i });
    expect(contact).toHaveLength(2); // the head's honest message, and changing her email in Account settings
    for (const link of contact) expect(link.getAttribute("href")).toBe("/contact");
    expect(screen.queryByRole("link", { name: /start your application/i })).toBeNull();
    // Her account is still hers: password and delete.
    const settings = screen.getByRole("region", { name: "Account settings" });
    expect(within(settings).getByRole("button", { name: "Change password" })).toBeTruthy();
    expect(within(settings).getByRole("button", { name: "Delete my account" })).toBeTruthy();
    // The menu offers only what is on the page.
    fireEvent.click(screen.getByRole("button", { name: /account menu/ }));
    const nav = screen.getByRole("navigation", { name: "My account" });
    expect(within(nav).getAllByRole("link").map((a) => a.textContent)).toEqual(["Profile", "Account settings"]);
  });

  it("still shows a pending application as in review", () => {
    renderAccount({ status: "pending", catalogue_number: null });
    expect(screen.getByText("Application under review")).toBeTruthy();
    expect(screen.getByText(/being reviewed/i)).toBeTruthy();
  });

  it("a pending member sees the review state: honest subline, no verified badge, membership card agrees", () => {
    renderAccount({ status: "pending", catalogue_number: null, member_since: null });
    expect(screen.getByRole("heading", { level: 1, name: "Rosa Diaz" })).toBeTruthy();
    expect(screen.getByText(/application under review/i)).toBeTruthy();
    expect(screen.queryByText(/approved member since/i)).toBeNull();
    expect(screen.queryByText(/verified member/i)).toBeNull();
    expect(screen.queryByText("Verified")).toBeNull();
    const membership = screen.getByRole("region", { name: "Membership" });
    expect(within(membership).getByText(/being reviewed/i)).toBeTruthy();
    expect(within(membership).getByText(/assigned once you’re approved/i)).toBeTruthy();
  });

  it("an approved member's cover: verified badge, specialty, work and place, her number and join date, a card preview", async () => {
    renderAccount();
    const cover = screen.getByRole("region", { name: "Rosa Diaz" });
    expect(within(cover).getByText("Verified member")).toBeTruthy();
    // The canvas's line under her name: specialty, then role · business; the surname set in italic.
    expect(within(cover).getByText("Food · Founder · Diaz Bakery")).toBeTruthy();
    expect(within(cover).getByRole("heading", { level: 1 }).querySelector("i")?.textContent).toBe("Diaz");
    expect(within(cover).getByText("Astoria")).toBeTruthy();
    const stat = (label: string) => within(cover).getByText(label).nextElementSibling?.textContent;
    expect([stat("Member"), stat("Joined")]).toEqual(["No. 27", "Jan 2026"]);
    fireEvent.click(within(cover).getByRole("button", { name: "View directory card" }));
    const pass = screen.getByRole("dialog", { name: "Rosa Diaz" });
    expect(within(pass).getByText("No. 27")).toBeTruthy();
    const membership = screen.getByRole("region", { name: "Membership" });
    expect(within(membership).getByText("Verified")).toBeTruthy();
    expect(within(membership).getByText("No. 27")).toBeTruthy();
    // A swatch saves her pass colour on the spot.
    fireEvent.click(within(pass).getByRole("radio", { name: "Rose" }));
    await waitFor(() => expect(fake.calls).toContainEqual(["saveProfileFn", { card_color: "rose" }]));
  });

  describe("before approval", () => {
    const locked = () => screen.getAllByText("Unlocks once you’re welcomed in");
    const joinLinks = () => screen.queryAllByRole("link", { name: /start your application/i });

    it("gatherings, headshot and introductions show the locked panel, pointing at /join when she hasn't applied", () => {
      renderAccount({ status: "pending", catalogue_number: null });
      expect(locked()).toHaveLength(3);
      for (const id of ["events", "headshot", "introductions"]) {
        expect(within(document.getElementById(id)!).getByText("Unlocks once you’re welcomed in")).toBeTruthy();
      }
      expect(joinLinks().map((a) => a.getAttribute("href"))).toEqual(["/join", "/join", "/join"]);
      expect(screen.queryByRole("button", { name: /request my session/i })).toBeNull();
    });

    it("a pending applicant (application on file) gets no /join link", async () => {
      const { queryClient } = renderAccount({ status: "pending", catalogue_number: null });
      act(() => queryClient.setQueryData(["profile", "u1"], (d: object) => ({ ...d, hasApplication: true })));
      await waitFor(() => expect(joinLinks()).toHaveLength(0));
      expect(locked()).toHaveLength(3);
    });
  });

  it("hides an inactive neighborhood from the select unless it is her current one", () => {
    const hoods = NEIGHBORHOOD_SEED.map((n) => (n.slug === "rego-park" ? { ...n, active: false } : n));
    const options = () =>
      selectOptions(screen.getByRole("combobox", { name: /neighborhood/i })).map((o) => o.textContent);
    renderAccount({ neighborhood: "Astoria" }, [], [], false, [[["neighborhoods"], hoods]]);
    editDirectoryCard();
    expect(options()).toContain("Sunnyside");
    expect(options()).not.toContain("Rego Park");
    cleanup();
    renderAccount({ neighborhood: "Rego Park" }, [], [], false, [[["neighborhoods"], hoods]]);
    editDirectoryCard();
    expect(options().filter((o) => o === "Rego Park")).toHaveLength(1);
    expect(screen.getByRole("combobox", { name: /neighborhood/i }).textContent).toContain("Rego Park");
  });

  describe("no neighborhood", () => {
    const select = () => screen.getByRole("combobox", { name: /neighborhood/i });

    it("offers a blank first choice, selected when she has none", () => {
      renderAccount({ neighborhood: null });
      editDirectoryCard();
      const first = selectOptions(select())[0]!;
      expect(first.textContent).toBe("Choose your neighborhood");
      expect(first.dataset.value).toBe("");
      expect(select().hasAttribute("data-placeholder")).toBe(true);
    });

    it("says it isn't chosen yet and introduces neighbors from across the constellation", () => {
      renderAccount({ neighborhood: null });
      expect(screen.getByText("Not chosen yet")).toBeTruthy();
      expect(screen.getByText("Neighbors from across the constellation.")).toBeTruthy();
    });

    it("still introduces her neighborhood first when she has one", () => {
      renderAccount({ neighborhood: "Astoria" });
      expect(screen.getByText("Neighbors from Astoria first, then across the constellation.")).toBeTruthy();
    });

    it("saves the blank choice as null", async () => {
      renderAccount({ neighborhood: "Astoria" });
      editDirectoryCard();
      chooseValue(select(), "");
      fake.results = [{ ...base, neighborhood: null }];
      fireEvent.click(save());
      await waitFor(() => expect(fake.calls).toContainEqual(["saveProfileFn", expect.objectContaining({ neighborhood: null })]));
    });
  });

  // The directory is members-only (owner decision, 2026-11-24): there is no public-website switch any more.
  describe("visibility", () => {
    const directorySwitch = () => screen.getByRole("switch", { name: /^show me in the member directory/i }) as HTMLButtonElement;
    const visibility = () => screen.getByRole("region", { name: "Visibility" });

    it("offers only the member directory switch, and no public page or link", () => {
      renderAccount({ directory_visible: true, public_profile: true });
      expect(within(visibility()).getAllByRole("switch")).toEqual([directorySwitch()]);
      expect(screen.queryByText(/public website/i)).toBeNull();
      expect(within(visibility()).queryByRole("link")).toBeNull();
    });

    it("says in one sentence who can see her card", () => {
      renderAccount({ directory_visible: false });
      expect(within(visibility()).getByText("Only you and the collective’s admins can see your card.")).toBeTruthy();
      fireEvent.click(directorySwitch());
      expect(within(visibility()).getByText("Only members of the collective can see your card.")).toBeTruthy();
      cleanup();
      renderAccount({ directory_visible: true, public_profile: true });
      expect(within(visibility()).getByText("Only members of the collective can see your card.")).toBeTruthy();
      cleanup();
      renderAccount({ status: "pending", catalogue_number: null, member_since: null });
      expect(within(visibility()).getByText(/stays private until you’re welcomed in/)).toBeTruthy();
      expect(within(visibility()).getByText(/choices you make now are saved/i)).toBeTruthy();
    });

    it("saves only the directory switch", async () => {
      renderAccount({ directory_visible: false });
      fireEvent.click(directorySwitch());
      fake.results = [{ ...base, directory_visible: true }];
      fireEvent.click(save());
      await waitFor(() => expect(fake.calls[0]).toEqual(["saveProfileFn", { directory_visible: true }]));
    });

    it("tells pending members a saved choice takes effect after approval", () => {
      renderAccount({ status: "pending", directory_visible: true });
      expect(directorySwitch().closest("label")?.textContent).toMatch(/if this is on then/i);
    });
  });

  it("shows a one-time You’re in panel for a newly approved member with a private card", () => {
    localStorage.removeItem("twc-youre-in:v1:u1");
    renderAccount({ directory_visible: false, public_profile: false });
    const panel = screen.getByRole("region", { name: "You’re in" });
    expect(within(panel).getByText(/private draft until you choose to show it/i)).toBeTruthy();
    expect(within(panel).getByRole("link", { name: /open visibility/i })).toBeTruthy();
    fireEvent.click(within(panel).getByRole("button", { name: "Got it" }));
    expect(screen.queryByRole("region", { name: "You’re in" })).toBeNull();
    cleanup();
    renderAccount({ directory_visible: false, public_profile: false });
    expect(screen.queryByRole("region", { name: "You’re in" })).toBeNull();
  });

  it.each([
    { directory_visible: true, public_profile: false },
    { directory_visible: true, public_profile: true },
  ])("hides You’re in once the card is listed ($directory_visible/$public_profile)", (visibility) => {
    localStorage.removeItem("twc-youre-in:v1:u1");
    renderAccount(visibility);
    expect(screen.queryByRole("region", { name: "You’re in" })).toBeNull();
  });

  it("pending members do not see You’re in", () => {
    localStorage.removeItem("twc-youre-in:v1:u1");
    renderAccount({ status: "pending", catalogue_number: null });
    expect(screen.queryByRole("region", { name: "You’re in" })).toBeNull();
  });

  describe("introductions", () => {
    it("are stamps with their real catalogue numbers", () => {
      renderAccount({}, [card("Lena Ortiz", 40), card("Mei Chen", 41)]);
      const sheet = within(document.getElementById("introductions")!);
      expect(sheet.getByText("nº 40")).toBeTruthy();
      expect(sheet.getByText("nº 41")).toBeTruthy();
      expect(sheet.getAllByRole("button").map((b) => b.getAttribute("aria-pressed"))).toEqual([null, null]);
    });

    it("open a card into a dialog with that member's bio", () => {
      renderAccount({}, [{ ...card("Lena Ortiz", 40), bio: "Lena paints murals." }, card("Mei Chen", 41)]);
      expect(screen.queryByRole("dialog")).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "View Lena Ortiz’s profile" }));
      const dialog = screen.getByRole("dialog", { name: "Lena Ortiz, member profile" });
      expect(within(dialog).getByText("Lena paints murals.")).toBeTruthy();
      fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("show an empty state, never demo members", () => {
      renderAccount({}, []);
      expect(screen.getByText(/no introductions yet/i)).toBeTruthy();
      expect(screen.queryByText(/sample profiles/i)).toBeNull();
      for (const m of demoMembers) expect(screen.queryByText(m.name)).toBeNull();
    });
  });

  describe("editing and saving", () => {
    it("there is no Save, Discard or status until something has changed", () => {
      renderAccount();
      expect(noSave()).toBe(true);
      editDirectoryCard();
      expect(noSave()).toBe(true);
      expect(screen.queryByRole("button", { name: /discard/i })).toBeNull();
      expect(status()).toBe("");
    });

    it("Discard drops the draft, closes the cards and takes the bar away", () => {
      renderAccount();
      editDirectoryCard();
      fireEvent.change(screen.getByLabelText(/^role/i), { target: { value: "Owner" } });
      expect(status()).toBe("Unsaved changes");
      fireEvent.click(button(/discard changes/i));
      expect(noSave()).toBe(true);
      expect(status()).toBe("");
      expect(screen.queryByLabelText(/^role/i)).toBeNull();
      expect(screen.getByText("Founder")).toBeTruthy();
      expect(fake.calls.filter(([c]) => c === "saveProfileFn")).toEqual([]);
    });

    it("edit → dirty → save sends only the changed fields, then goes quiet and clean", async () => {
      renderAccount();
      editDirectoryCard();
      fireEvent.change(screen.getByLabelText(/^role/i), { target: { value: "  Owner " } });
      expect(save().disabled).toBe(false);
      expect(status()).toBe("Unsaved changes");
      fake.results = [{ ...base, role_title: "Owner" }];
      fireEvent.click(save());
      await waitFor(() => expect(fake.calls[0]).toEqual(["saveProfileFn", { role_title: "Owner" }]));
      expect(fake.calls.filter(([c]) => c === "saveProfileFn")).toHaveLength(1);
      await waitFor(() => expect(status()).toBe("All changes saved"));
      expect(noSave()).toBe(true);
      expect(screen.getByText("Owner")).toBeTruthy();
    });

    it("shows a quiet error when the save fails, keeping the edit", async () => {
      renderAccount();
      editDirectoryCard();
      fireEvent.change(screen.getByLabelText(/^role/i), { target: { value: "Owner" } });
      fake.results = [new Error("We couldn’t save that.")];
      fireEvent.click(save());
      expect((await screen.findByRole("alert")).textContent).toMatch(/couldn’t save that/);
      expect(save().disabled).toBe(false);
    });

    it("a row's Add opens its card for editing with that field focused", () => {
      renderAccount({ website: "" });
      fireEvent.click(button("Add website"));
      expect(document.activeElement).toBe(screen.getByLabelText(/^website/i));
      expect(screen.getByLabelText(/^full name/i)).toBeTruthy();
    });

    it("Edit and Add buttons name their card or field", () => {
      renderAccount({ business: "", website: "" });
      expect(button("Edit directory card")).toBeTruthy();
      expect(button("Edit in your words")).toBeTruthy();
      expect(button("Add business")).toBeTruthy();
      expect(button("Add website")).toBeTruthy();
    });

    it("doesn't call a portrait pick or a reverted edit unsaved, and goes clean after saving", async () => {
      renderAccount();
      const ok = new File(["x"], "me.png", { type: "image/png" });
      fake.results = [new Promise(() => {}) as never]; // upload never settles
      fireEvent.change(screen.getByLabelText(/upload a portrait/i), { target: { files: [ok] } });
      await act(() => new Promise((r) => setTimeout(r, 20))); // let the upload take its never-settling result
      expect(noSave()).toBe(true);
      editDirectoryCard();
      const name = screen.getByLabelText(/^full name/i);
      fireEvent.change(name, { target: { value: "Rosa M. Diaz" } });
      fireEvent.change(name, { target: { value: "Rosa Diaz" } });
      expect(noSave()).toBe(true);
      fireEvent.change(name, { target: { value: "Rosa M. Diaz" } });
      expect(save().disabled).toBe(false);
      fake.reset();
      fake.results = [{ ...base, full_name: "Rosa M. Diaz" }];
      fireEvent.click(save());
      await waitFor(() => expect(noSave()).toBe(true));
      expect(screen.getByRole("heading", { level: 1, name: "Rosa M. Diaz" })).toBeTruthy();
    });

    it("Preview card opens her member pass with her unsaved values", () => {
      renderAccount();
      editDirectoryCard();
      fireEvent.change(screen.getByLabelText(/^full name/i), { target: { value: "Rosa M. Diaz" } });
      fireEvent.change(screen.getByLabelText(/^role/i), { target: { value: "Head Baker" } });
      fireEvent.click(button(/preview card/i));
      const dialog = screen.getByRole("dialog", { name: "Rosa M. Diaz" });
      expect(within(dialog).getByText("Head Baker, Diaz Bakery")).toBeTruthy();
      expect(fake.calls).toEqual([]);
    });
  });

  describe("where you belong", () => {
    const where = () => screen.getByRole("region", { name: "Where you belong" });

    it("sits right under Visibility: her neighborhood's post, nearest stop, where it gathers and who's near", () => {
      const ev = { id: "e1", title: "Supper Club", description: "", location: "Bar Bolonat", neighborhood: "Astoria", starts_at: "2099-11-09T00:30:00Z", created_at: "" };
      renderAccount({}, [card("Lena Ortiz", 3)], [ev]);
      const order = [...document.querySelectorAll("main section[id]")].map((el) => el.id);
      expect(order.slice(0, 4)).toEqual(["profile", "visibility", "where", "directory-card"]);
      const text = where().textContent;
      expect(text).toContain("Queens, New York 11106");
      expect(text).toContain("Broadway, N, W trains");
      expect(text).toContain("Bar Bolonat");
      expect(text).toContain("1 neighbor");
      expect(text).toContain("never your address");
      expect(within(where()).getByRole("group", { name: "Map of Astoria" })).toBeTruthy();
    });

    it("drops what it doesn't know: a neighborhood with no place has no map or stop; no gathering, no row", () => {
      renderAccount({ neighborhood: "Bayside" }, [], [], false, [[["neighborhoods"], [...NEIGHBORHOOD_SEED, { slug: "bayside", name: "Bayside", color: "#123456", logoUrl: null, active: true }]]]);
      const text = where().textContent;
      expect(text).toContain("Bayside");
      expect(text).not.toMatch(/Nearest stop|Gathers at|°|Queens|Brooklyn/);
      expect(within(where()).queryByRole("group")).toBeNull();
      expect(text).toContain("Just you, for now");
    });

    it("words her post from her own area", () => {
      renderAccount({ neighborhood: "Greenpoint" });
      expect(where().textContent).toContain("Brooklyn, New York");
      expect(where().textContent).not.toContain("Queens");
    });

    it("without a neighborhood, offers to choose one in the directory card's picker", () => {
      renderAccount({ neighborhood: null });
      fireEvent.click(within(where()).getByRole("button", { name: "Choose your neighborhood" }));
      expect(document.activeElement).toBe(screen.getByRole("combobox", { name: /neighborhood/i }));
    });
  });

  describe("navigation", () => {
    it("tabs anchor this page's account cards; sign out sits beside her name", () => {
      renderAccount();
      fireEvent.click(screen.getByRole("button", { name: /account menu/ }));
      const nav = screen.getByRole("navigation", { name: "My account" });
      for (const name of ["Home", "Members", "Gatherings", "Introductions", "Admin"]) expect(within(nav).queryByRole("link", { name })).toBeNull();
      // Every card worth jumping to, in page order (the directory is members-only, so it is the Directory card).
      expect(within(nav).getAllByRole("link").map((a) => [a.textContent, a.getAttribute("href")])).toEqual([
        ["Profile", "#profile"], ["Visibility", "#visibility"], ["Directory card", "#directory-card"], ["Membership", "#membership"],
        ["Headshot session", "#headshot"], ["Events", "#events"], ["Account settings", "#settings"],
      ]);
      const order = [...document.querySelectorAll("main section[id]")].map((el) => el.id);
      const anchors = within(nav).getAllByRole("link").map((a) => a.getAttribute("href")!.slice(1));
      expect(order.filter((id) => anchors.includes(id))).toEqual(anchors);
      expect(within(nav).queryByRole("link", { name: /public/i })).toBeNull();
      expect(within(nav).getByRole("link", { name: "Profile" }).getAttribute("aria-current")).toBe("location");
      expect(screen.getByRole("button", { name: "Sign out" })).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Open menu" })).toBeNull();
      // The canvas's member header: its four pages (no Rooms or Upgrade: nothing stands behind them), her flag.
      const pages = within(screen.getByRole("navigation", { name: "Members" })).getAllByRole("link").filter((a) => !a.closest("[aria-label='My account']"));
      expect(pages.map((a) => [a.textContent, a.getAttribute("href"), a.getAttribute("aria-current")])).toEqual([
        ["Feed", "/feed", null], ["Directory", "/directory", null], ["Calendar", "/calendar", null], ["My profile", "/account", "page"],
      ]);
      expect(screen.getByText("Member", { selector: ".twc-flag" })).toBeTruthy();
      expect(document.getElementById("events")).toBeTruthy();
      expect(document.getElementById("introductions")).toBeTruthy();
    });

    it("on phones each member header link is a 44px tap target (A7)", () => {
      const css = readFileSync(resolve(process.cwd(), "src/app/twc-app.css"), "utf8");
      const phone = /@media \(max-width: 640px\) \{\s*\.air-nav > a \{([^}]*)\}/.exec(css)?.[1] ?? "";
      expect(phone).toMatch(/min-height: 44px/);
      expect(phone).toMatch(/min-width: 44px/);
    });
  });

  describe("gatherings and headshot dates", () => {
    afterEach(() => {
      restoreTz();
      vi.useRealTimers();
    });

    it("shows an empty state when nothing is scheduled", () => {
      renderAccount({}, [], []);
      expect(screen.getByText(/no events on the calendar yet/i)).toBeTruthy();
    });

    it.each([
      ["loading", new Promise(() => {})],
      ["failed", new Error("offline")],
    ])("hides the empty state while events are %s", async (_label, result) => {
      fake.results = [result as never];
      renderWithQueries(<Page />, [
        viewer(),
        [["profile", "u1"], { profile: base, avatarUrl: undefined }],
        [["rsvps", "u1"], []],
        [["rsvps", "u1", "plans"], []],
        [["booking", "u1"], null],
        [["intros", "u1", base.neighborhood], []],
      ]);
      await act(() => new Promise((r) => setTimeout(r, 20)));
      expect(fake.calls[0]).toEqual(["eventsFn", { from: expect.any(String) }]);
      expect(screen.queryByText(/no events on the calendar yet/i)).toBeNull();
    });

    const ev = (id: string, over: object = {}) => ({
      id, slug: "", full: false, title: `Event ${id}`, description: "", location: "Bar", neighborhood: "Astoria",
      starts_at: "2099-11-09T00:30:00Z", kind: "gathering", ...over,
    });
    const withPlans = (events: unknown[], plans: unknown[]) => renderAccount({}, [], events, false, [[["rsvps", "u1", "plans"], plans]]);

    it("a seat is an invitation until taken; going is a chip with a quiet way out", async () => {
      withPlans([ev("e1", { title: "Supper Club" })], []);
      expect(button("Save my seat at Supper Club")).toBeTruthy();
      // The ticket opens the event's page (Cal's slug, or its uid on a row without one: the page takes either).
      expect(screen.getByRole("link", { name: "Supper Club" }).getAttribute("href")).toBe("/events/e1");
      expect(screen.queryByText("You’re going")).toBeNull();
      cleanup();
      withPlans([ev("e1", { title: "Supper Club" })], [{ eventId: "e1", status: "GOING", waitlisted: false }]);
      expect(screen.getByText("You’re going")).toBeTruthy();
      expect(screen.queryByRole("button", { name: /save my seat/i })).toBeNull();
      fireEvent.click(button("Can’t make it to Supper Club"));
      await waitFor(() => expect(fake.calls[0]).toEqual(["setRsvpFn", { eventId: "e1", going: false }]));
    });

    it("shows her real answer on each event, her plans first, then what's coming up", () => {
      withPlans(
        [ev("open"), ev("going"), ev("maybe"), ev("waiting", { full: true }), ev("full", { full: true }), ev("maybe-full", { full: true })],
        [
          { eventId: "going", status: "GOING", waitlisted: false }, { eventId: "maybe", status: "MAYBE", waitlisted: false },
          { eventId: "waiting", status: null, waitlisted: true }, { eventId: "maybe-full", status: "MAYBE", waitlisted: false },
        ],
      );
      const events = within(document.getElementById("events")!);
      const titles = (name: string) => within(events.getByRole("list", { name })).getAllByRole("heading").map((h) => h.textContent);
      expect(events.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual(["Your plans", "Coming up"]);
      expect(titles("Your plans")).toEqual(["Event going", "Event maybe", "Event waiting", "Event maybe-full"]);
      expect(titles("Coming up")).toEqual(["Event open", "Event full"]);
      const row = (id: string) => within(events.getByRole("link", { name: `Event ${id}` }).closest("li")!);
      expect(row("going").getByText("You’re going")).toBeTruthy();
      expect(row("maybe").getByText("Maybe")).toBeTruthy();
      expect(row("maybe").getByRole("button", { name: "I’m going at Event maybe" })).toBeTruthy();
      expect(row("maybe").getByRole("button", { name: "Can’t make it to Event maybe" })).toBeTruthy();
      expect(row("maybe-full").getByRole("button", { name: "Join the waitlist for Event maybe-full" })).toBeTruthy();
      expect(row("waiting").getByText("On the waitlist")).toBeTruthy();
      expect(row("waiting").queryByRole("button", { name: /join the waitlist/i })).toBeNull();
      expect(row("waiting").getByRole("button", { name: "Leave the waitlist for Event waiting" })).toBeTruthy();
      expect(row("full").getByRole("button", { name: "Full · Join the waitlist for Event full" })).toBeTruthy();
      expect(row("open").getByRole("button", { name: "Save my seat at Event open" })).toBeTruthy();
    });

    it("with no answers yet, the events stand alone, without a plans heading", () => {
      withPlans([ev("e1")], []);
      expect(within(document.getElementById("events")!).queryByRole("heading", { level: 3 })).toBeNull();
    });

    it("joins and leaves a full event's waitlist as herself, then refreshes her answers and the events", async () => {
      const { queryClient } = withPlans([ev("waiting", { full: true }), ev("full", { full: true })], [{ eventId: "waiting", status: null, waitlisted: true }]);
      const refreshed = vi.spyOn(queryClient, "invalidateQueries");
      fireEvent.click(button("Full · Join the waitlist for Event full"));
      await waitFor(() => expect(fake.calls[0]).toEqual(["setMemberWaitlistFn", { eventId: "full", on: true }]));
      await waitFor(() => expect(refreshed.mock.calls.map(([f]) => f?.queryKey)).toEqual(expect.arrayContaining([["rsvps"], ["events"]])));
      // (The refresh above emptied the fakes' events; a fresh page for the way out.)
      cleanup();
      fake.reset();
      withPlans([ev("waiting", { full: true })], [{ eventId: "waiting", status: null, waitlisted: true }]);
      fireEvent.click(button("Leave the waitlist for Event waiting"));
      await waitFor(() => expect(fake.calls[0]).toEqual(["setMemberWaitlistFn", { eventId: "waiting", on: false }]));
    });

    it("says why a waitlist join was refused (a spot opened)", async () => {
      withPlans([ev("full", { full: true })], []);
      fake.results = [new Error("There are still spots open, so you can RSVP instead.")];
      fireEvent.click(button("Full · Join the waitlist for Event full"));
      expect((await screen.findByRole("alert")).textContent).toMatch(/still spots open/);
    });

    it("a full event offers its waitlist, not a seat it can't take", () => {
      withPlans([ev("e1", { slug: "supper-club", full: true, title: "Supper Club" })], []);
      expect(screen.queryByRole("button", { name: /save my seat/i })).toBeNull();
      expect(button("Full · Join the waitlist for Supper Club")).toBeTruthy();
      expect(screen.getByRole("link", { name: "Supper Club" }).getAttribute("href")).toBe("/events/supper-club");
    });

    it("formats event day and time in New York time", () => {
      setTz("Asia/Tokyo");
      const ev = { id: "e1", title: "Supper Club", description: "", location: "Bar", neighborhood: "Astoria", starts_at: "2026-11-09T00:30:00Z", created_at: "" };
      renderAccount({}, [], [ev]);
      const item = screen.getByText("Supper Club").closest("li") as HTMLElement;
      expect(item.textContent).toMatch(/Nov\s*8/);
      expect(item.textContent).toMatch(/7:30 PM/);
    });

    it("lets members pick today in their own timezone", () => {
      setTz("America/Los_Angeles");
      vi.useFakeTimers({ now: new Date("2026-11-09T03:00:00Z"), toFake: ["Date"] });
      renderAccount();
      fireEvent.click(button("Add preferred date"));
      expect(document.activeElement).toBe(screen.getByLabelText(/preferred date/i));
      expect(screen.getByLabelText(/preferred date/i).getAttribute("min")).toBe("2026-11-08");
    });

    it("requests a headshot session through the existing booking call", async () => {
      renderAccount();
      fireEvent.click(button("Add preferred date"));
      fireEvent.change(screen.getByLabelText(/preferred date/i), { target: { value: "2099-12-03" } });
      chooseValue(screen.getByLabelText(/time of day/i), "Evening");
      fireEvent.change(screen.getByLabelText(/^notes/i), { target: { value: "Bringing cakes" } });
      fake.results = [{ id: "b1", user_id: "u1", preferred_date: "2099-12-03", preferred_time: "Evening", notes: "Bringing cakes", status: "requested", created_at: "" }];
      fireEvent.click(button(/request my session/i));
      await waitFor(() =>
        expect(fake.calls).toContainEqual(["bookHeadshotFn", { preferred_date: "2099-12-03", preferred_time: "Evening", notes: "Bringing cakes" }]),
      );
      expect(await screen.findByText(/request received/i)).toBeTruthy();
    });

    // T6: the member sees what an admin decided, not "Request received" forever.
    it.each([
      ["requested", /request received/i, /we’ll confirm it here/i],
      ["confirmed", /session confirmed/i, /changing it sends it back/i],
      ["declined", /we couldn’t fit this one in/i, /choose another date/i],
    ])("shows a %s headshot request's status", (status, title, body) => {
      const booking = { id: "b1", user_id: "u1", preferred_date: "2026-12-03", preferred_time: "Morning", notes: "", status, created_at: "" };
      renderWithQueries(<Page />, [
        viewer(),
        [["profile", "u1"], { profile: base, avatarUrl: undefined }],
        [["events"], []],
        [["rsvps", "u1"], []],
        [["booking", "u1"], booking],
        [["intros", "u1", base.neighborhood], []],
      ]);
      expect(screen.getByText(title)).toBeTruthy();
      expect(screen.getByText(body)).toBeTruthy();
      expect(screen.getByText(/Thursday, December 3 · Morning/)).toBeTruthy();
    });
  });

  it("rejects an oversized portrait before uploading", async () => {
    renderAccount();
    const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big.jpg", { type: "image/jpeg" });
    const input = screen.getByLabelText(/upload a portrait/i) as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { files: [big] } });
    });
    expect((await screen.findByRole("alert")).textContent).toMatch(/5 MB/);
    expect(fake.calls.some((c) => c[0] === "/api/images")).toBe(false);
  });

  describe("unsaved changes (A1)", () => {
    const toCalendar = { current: { pathname: "/account" }, next: { pathname: "/calendar" } };
    const makeDirty = () => {
      editDirectoryCard();
      fireEvent.change(screen.getByLabelText(/^role/i), { target: { value: "Owner" } });
    };

    it("the card's button says Done editing, and closing the fields keeps the draft (and the save bar)", () => {
      renderAccount();
      editDirectoryCard();
      fireEvent.change(screen.getByLabelText(/^role/i), { target: { value: "Owner" } });
      fireEvent.click(button("Done editing directory card"));
      expect(screen.queryByLabelText(/^role/i)).toBeNull();
      expect(screen.getByText("Owner")).toBeTruthy();
      expect(status()).toBe("Unsaved changes");
      expect(save()).toBeTruthy();
    });

    it("guards nothing while the draft is clean", () => {
      renderAccount();
      expect(blocker.opts?.disabled).toBe(true);
      expect(blocker.opts?.enableBeforeUnload).toBe(false);
    });

    it("asks before another page drops the draft: Stay keeps her here, Leave lets her go", async () => {
      renderAccount();
      makeDirty();
      expect(blocker.opts?.disabled).toBe(false);
      expect(blocker.opts?.enableBeforeUnload).toBe(true);

      let blocked = blocker.opts!.shouldBlockFn(toCalendar);
      const dialog = await screen.findByRole("alertdialog");
      expect(within(dialog).getByRole("heading", { name: "Leave this page?" })).toBeTruthy();
      expect(dialog.textContent).toMatch(/unsaved changes to your profile will be lost/i);
      fireEvent.click(within(dialog).getByRole("button", { name: "Stay" }));
      await expect(blocked).resolves.toBe(true);
      expect(status()).toBe("Unsaved changes");

      blocked = blocker.opts!.shouldBlockFn(toCalendar);
      fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Leave" }));
      await expect(blocked).resolves.toBe(false);
    });

    it("never asks when she only moves between this page's cards", async () => {
      renderAccount();
      makeDirty();
      await expect(blocker.opts!.shouldBlockFn({ current: { pathname: "/account" }, next: { pathname: "/account" } })).resolves.toBe(false);
      expect(screen.queryByRole("alertdialog")).toBeNull();
    });

    it("stops guarding once the draft is saved or discarded", () => {
      renderAccount();
      makeDirty();
      fireEvent.click(button(/discard changes/i));
      expect(blocker.opts?.disabled).toBe(true);
    });
  });

  describe("empty words (A8)", () => {
    it("an empty bio and ask read as muted placeholders with Add, not as her words", () => {
      renderAccount({ bio: "", looking_for: "" });
      const bio = screen.getByText(/^No bio added\./);
      const ask = screen.getByText(/^No one named yet\./);
      for (const empty of [bio, ask]) {
        expect(empty.closest(".air-val--empty")).toBeTruthy();
        expect(empty.closest(".air-ruled, .air-ruled-serif")).toBeNull();
      }
      fireEvent.click(button("Add bio"));
      expect(document.activeElement).toBe(screen.getByLabelText(/^bio/i));
      cleanup();
      renderAccount({ bio: "", looking_for: "" });
      fireEvent.click(button("Add looking to meet"));
      expect(document.activeElement).toBe(screen.getByLabelText(/^looking to meet/i));
    });

    it("her words, once written, are set large as before", () => {
      renderAccount({ bio: "I bake.", looking_for: "Cafe owners" });
      expect(screen.getByText("I bake.").classList.contains("air-ruled-serif")).toBe(true);
      expect(screen.getByText("Cafe owners").classList.contains("air-ruled")).toBe(true);
      expect(screen.queryByRole("button", { name: /add bio|add looking/i })).toBeNull();
    });
  });

  describe("directory card anchors (A6)", () => {
    afterEach(() => window.history.replaceState(null, "", "/"));

    it("an old #public-card link lands on the Directory card, and the address shows its new anchor", () => {
      const scrolled = vi.fn();
      Element.prototype.scrollIntoView = scrolled;
      window.history.replaceState(null, "", "/account#public-card");
      renderAccount();
      const card = screen.getByRole("region", { name: "Directory card" });
      expect(card.id).toBe("directory-card");
      expect(window.location.hash).toBe("#directory-card");
      expect(scrolled.mock.contexts[0]).toBe(card);
      expect(document.activeElement).toBe(within(card).getByRole("heading", { level: 2 }));
    });
  });

  describe("account settings (A3)", () => {
    const settings = () => within(screen.getByRole("region", { name: "Account settings" }));

    it("comes after the member cards, with her email, a password change and Delete my account (moved from Membership)", () => {
      renderAccount();
      const order = [...document.querySelectorAll("main section[id]")].map((el) => el.id);
      expect(order.at(-1)).toBe("settings");
      expect(settings().getByText("rosa@example.test")).toBeTruthy();
      expect(settings().getByRole("link", { name: /contact us/i }).getAttribute("href")).toBe("/contact");
      expect(settings().getByRole("button", { name: "Delete my account" })).toBeTruthy();
      expect(within(screen.getByRole("region", { name: "Membership" })).queryByRole("button", { name: /delete/i })).toBeNull();
    });

    it("changes her password with her current one, signing other devices out", async () => {
      auth.changePassword.mockResolvedValue({ data: { token: "t" }, error: null });
      renderAccount();
      fireEvent.click(settings().getByRole("button", { name: "Change password" }));
      expect(document.activeElement).toBe(settings().getByLabelText("Current password"));
      fireEvent.change(settings().getByLabelText("Current password"), { target: { value: "old secret" } });
      fireEvent.change(settings().getByLabelText("New password"), { target: { value: "new secret 123" } });
      fireEvent.click(settings().getByRole("button", { name: "Change password" }));
      await waitFor(() => expect(auth.changePassword).toHaveBeenCalledWith({ currentPassword: "old secret", newPassword: "new secret 123", revokeOtherSessions: true }));
      expect(await settings().findByText(/password changed/i)).toBeTruthy();
      expect(settings().queryByLabelText("Current password")).toBeNull();
      expect(document.activeElement).toBe(settings().getByRole("button", { name: "Change password" }));
    });

    it("says plainly when the current password is wrong, or there were too many tries", async () => {
      auth.changePassword.mockResolvedValueOnce({ data: null, error: { code: "INVALID_PASSWORD", status: 400 } });
      renderAccount();
      fireEvent.click(settings().getByRole("button", { name: "Change password" }));
      fireEvent.change(settings().getByLabelText("Current password"), { target: { value: "nope" } });
      fireEvent.change(settings().getByLabelText("New password"), { target: { value: "new secret 123" } });
      fireEvent.click(settings().getByRole("button", { name: "Change password" }));
      expect((await settings().findByRole("alert")).textContent).toBe("That current password didn’t match. Try again.");
      auth.changePassword.mockResolvedValueOnce({ data: null, error: { status: 429 } });
      fireEvent.click(settings().getByRole("button", { name: "Change password" }));
      await waitFor(() => expect(settings().getByRole("alert").textContent).toMatch(/too many tries/i));
    });

    it("a Google-only account is told she signs in with Google, with no password form", async () => {
      auth.listAccounts.mockResolvedValue({ data: [{ providerId: "google" }], error: null });
      renderAccount();
      expect(await settings().findByText("You sign in with Google")).toBeTruthy();
      expect(settings().queryByRole("button", { name: "Change password" })).toBeNull();
    });
  });
});
