// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import type { MemberProfile } from "@/index";
import { demoMembers } from "@/showcase/demo-members";
import type { Profile } from "@/features/members/queries";
import { NEIGHBORHOOD_SEED } from "@/features/neighborhoods/queries";
import { renderWithQueries, stubDialog } from "@/test/dom";
import { restoreTz, setTz } from "@/test/tz";
import { fake } from "@/test/fake-fns";

vi.mock("@/features/members/fns", async (orig) => (await import("@/test/fake-fns")).fakeFns(orig));
vi.mock("@/features/events/fns", async (orig) => (await import("@/test/fake-fns")).fakeFns(orig));
vi.mock("@/features/auth/fns", async (orig) => (await import("@/test/fake-fns")).fakeFns(orig));
vi.mock("@/app/api", async () => (await import("@/test/fake-fns")).fakeApi);
vi.mock("@tanstack/react-router", async (orig) => ({ ...(await orig<object>()), ...(await import("@/test/dom")).routerStubs }));

import { Route } from "@/routes/_authenticated/account";

vi.spyOn(Route, "useRouteContext").mockReturnValue({ user: { id: "u1" } } as never);
const Page = Route.options.component as React.ComponentType;
let restoreDialog: (() => void) | undefined;
afterEach(() => {
  cleanup();
  fake.reset();
  restoreDialog?.();
  restoreDialog = undefined;
});

const base: Profile = {
  id: "u1", full_name: "Rosa Diaz", role_title: "Founder", business: "Diaz Bakery", neighborhood: "Astoria",
  specialty: "Food", bio: "", looking_for: "", website: "", avatar_path: null, business_logo_url: null, directory_visible: false,
  public_profile: false, status: "approved", catalogue_number: 27, member_since: "2026-01-05T12:00:00Z",
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
    ...extra,
    viewer(admin),
    [["profile", "u1"], { profile, avatarUrl: undefined, logoUrl }],
    [["events"], events],
    [["rsvps", "u1"], []],
    [["booking", "u1"], null],
    [["intros", "u1", profile.neighborhood], intros],
  ]);
}

describe("/account", () => {
  describe("business logo", () => {
    const png = () => new File(["x"], "logo.PNG", { type: "image/png" });

    it("is optional: an upload stores it in her own avatars folder and points her profile at it", async () => {
      renderAccount();
      expect(screen.queryByRole("button", { name: /remove logo/i })).toBeNull();
      fake.results = [{ ...base, business_logo_url: "u1/logo-1.png" }];
      fireEvent.change(screen.getByLabelText(/upload a business logo/i), { target: { files: [png()] } });
      await waitFor(() => expect(fake.calls.map(([c]) => c)).toContain("/api/images"));
      const form = fake.calls.find(([c]) => c === "/api/images")![1] as FormData;
      expect([form.get("kind"), (form.get("file") as File).name]).toEqual(["logo", "logo.PNG"]);
    });

    it("rejects a GIF or a file over 5 MB before any upload", async () => {
      renderAccount();
      const input = screen.getByLabelText(/upload a business logo/i);
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

  it("shows an Admin link to /admin for admins only", () => {
    renderAccount({}, [], [], true);
    expect(screen.getByRole("link", { name: "Admin" }).getAttribute("href")).toBe("/admin");
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
    expect(screen.getByText(/wasn’t approved this time/i)).toBeTruthy();
    expect(screen.getByText("Not approved")).toBeTruthy();
  });

  it("still shows a pending application as in review", () => {
    renderAccount({ status: "pending", catalogue_number: null });
    expect(screen.getByText("In review")).toBeTruthy();
    expect(screen.getByText(/being reviewed/i)).toBeTruthy();
  });

  it("hides an inactive neighborhood from the select unless it is her current one", () => {
    const hoods = NEIGHBORHOOD_SEED.map((n) => (n.slug === "rego-park" ? { ...n, active: false } : n));
    const options = () =>
      within(screen.getByRole("combobox", { name: /neighborhood/i })).getAllByRole("option").map((o) => o.textContent);
    renderAccount({ neighborhood: "Astoria" }, [], [], false, [[["neighborhoods"], hoods]]);
    expect(options()).toContain("Sunnyside");
    expect(options()).not.toContain("Rego Park");
    cleanup();
    renderAccount({ neighborhood: "Rego Park" }, [], [], false, [[["neighborhoods"], hoods]]);
    expect(options().filter((o) => o === "Rego Park")).toHaveLength(1);
    expect((screen.getByRole("combobox", { name: /neighborhood/i }) as HTMLSelectElement).value).toBe("Rego Park");
  });

  describe("no neighborhood", () => {
    const select = () => screen.getByRole("combobox", { name: /neighborhood/i }) as HTMLSelectElement;

    it("offers a blank first choice, selected when she has none", () => {
      renderAccount({ neighborhood: null });
      const first = within(select()).getAllByRole("option")[0] as HTMLOptionElement;
      expect(first.textContent).toBe("Choose your neighborhood");
      expect(first.value).toBe("");
      expect(select().value).toBe("");
    });

    it("shows a dash in the header and introduces neighbors from across the constellation", () => {
      renderAccount({ neighborhood: null });
      const term = screen.getByText("Neighborhood", { selector: "dt" });
      expect(term.nextElementSibling?.textContent).toBe("—");
      expect(screen.getByText("Neighbors from across the constellation.")).toBeTruthy();
    });

    it("still introduces her neighborhood first when she has one", () => {
      renderAccount({ neighborhood: "Astoria" });
      expect(screen.getByText("Neighbors from Astoria first, then across the constellation.")).toBeTruthy();
    });

    it("saves the blank choice as null", async () => {
      renderAccount({ neighborhood: "Astoria" });
      fireEvent.change(select(), { target: { value: "" } });
      fake.results = [{ ...base, neighborhood: null }];
      fireEvent.click(screen.getByRole("button", { name: /save my card/i }));
      await waitFor(() => expect(fake.calls).toContainEqual(["saveProfileFn", expect.objectContaining({ neighborhood: null })]));
    });
  });

  describe("public profile switch", () => {
    const publicSwitch = () => screen.getByRole("switch", { name: /show my profile on the public website/i }) as HTMLInputElement;
    const directorySwitch = () => screen.getByRole("switch", { name: /^show me in the member directory/i }) as HTMLInputElement;

    it("says plainly that anyone on the internet can see the card", () => {
      renderAccount();
      expect(publicSwitch().closest("label")?.textContent).toMatch(/anyone on the internet/i);
    });

    it("is disabled until the directory switch is on", () => {
      renderAccount({ directory_visible: false });
      expect(publicSwitch().disabled).toBe(true);
      fireEvent.click(directorySwitch());
      expect(publicSwitch().disabled).toBe(false);
    });

    it("is saved with the profile", async () => {
      renderAccount({ directory_visible: true });
      fireEvent.click(publicSwitch());
      fake.results = [{ ...base, directory_visible: true, public_profile: true }];
      fireEvent.click(screen.getByRole("button", { name: /save my card/i }));
      await waitFor(() =>
        expect(fake.calls).toContainEqual(["saveProfileFn", expect.objectContaining({ directory_visible: true, public_profile: true })]),
      );
    });

    it("switching the directory off un-publishes on save, and re-listing doesn't republish", async () => {
      renderAccount({ directory_visible: true, public_profile: true });
      expect(publicSwitch().checked).toBe(true);
      fireEvent.click(directorySwitch());
      expect(publicSwitch().checked).toBe(false);
      fireEvent.click(directorySwitch());
      expect(publicSwitch().checked).toBe(false);
      fireEvent.click(directorySwitch());
      fake.results = [{ ...base }];
      fireEvent.click(screen.getByRole("button", { name: /save my card/i }));
      await waitFor(() =>
        expect(fake.calls).toContainEqual(["saveProfileFn", expect.objectContaining({ directory_visible: false, public_profile: false })]),
      );
    });

    it("tells members it only goes live once approved", () => {
      renderAccount({ status: "pending", directory_visible: true });
      expect(publicSwitch().closest("label")?.textContent).toMatch(/once you’re approved/i);
    });
  });

  describe("introductions", () => {
    it("show real catalogue numbers", () => {
      renderAccount({}, [card("Lena Ortiz", 40), card("Mei Chen", 41)]);
      expect(screen.getByLabelText("Catalogue number 40")).toBeTruthy();
      expect(screen.getByLabelText("Catalogue number 41")).toBeTruthy();
    });

    it("open a card into a dialog with that member's bio", () => {
      restoreDialog = stubDialog();
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

  it("previews unsaved edits and says they are unsaved", () => {
    renderAccount();
    const preview = screen.getByRole("complementary", { name: /card preview/i });
    expect(within(preview).queryByText(/unsaved/i)).toBeNull();
    fireEvent.input(screen.getByLabelText(/full name/i), { target: { value: "Rosa M. Diaz" } });
    expect(within(preview).getAllByText("Rosa M. Diaz").length).toBeGreaterThan(0);
    expect(within(preview).getByText(/unsaved/i)).toBeTruthy();
    expect(fake.calls).toEqual([]);
  });

  it("doesn't call a portrait pick or a reverted edit unsaved, and goes clean after saving", async () => {
    renderAccount();
    const preview = screen.getByRole("complementary", { name: /card preview/i });
    const name = screen.getByLabelText(/full name/i);
    const ok = new File(["x"], "me.png", { type: "image/png" });
    fake.results = [new Promise(() => {}) as never]; // upload never settles
    fireEvent.change(screen.getByLabelText(/upload a portrait/i), { target: { files: [ok] } });
    await act(() => new Promise((r) => setTimeout(r, 20))); // let the upload take its never-settling result
    expect(within(preview).queryByText(/unsaved/i)).toBeNull();
    fireEvent.input(name, { target: { value: "Rosa M. Diaz" } });
    fireEvent.input(name, { target: { value: "Rosa Diaz" } });
    expect(within(preview).queryByText(/unsaved/i)).toBeNull();
    fireEvent.input(name, { target: { value: "Rosa M. Diaz" } });
    fake.reset();
    fake.results = [{ ...base, full_name: "Rosa M. Diaz" }];
    fireEvent.click(screen.getByRole("button", { name: /save my card/i }));
    await waitFor(() => expect(within(preview).queryByText(/unsaved/i)).toBeNull());
    expect(within(preview).getAllByText("Rosa M. Diaz").length).toBeGreaterThan(0);
  });

  describe("gatherings and headshot dates", () => {
    afterEach(() => {
      restoreTz();
      vi.useRealTimers();
    });

    it("shows an empty state when nothing is scheduled", () => {
      renderAccount({}, [], []);
      expect(screen.getByText(/no gatherings on the calendar yet/i)).toBeTruthy();
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
        [["booking", "u1"], null],
        [["intros", "u1", base.neighborhood], []],
      ]);
      await act(() => new Promise((r) => setTimeout(r, 20)));
      expect(fake.calls[0]).toEqual(["eventsFn", { from: expect.any(String) }]);
      expect(screen.queryByText(/no gatherings on the calendar yet/i)).toBeNull();
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
      expect(screen.getByLabelText(/preferred date/i).getAttribute("min")).toBe("2026-11-08");
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
});
