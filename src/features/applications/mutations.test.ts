import { beforeEach, describe, expect, it, vi } from "vitest";
import { fake } from "@/test/fake-supabase";

vi.mock("@/app/supabase", async () => (await import("@/test/fake-supabase")).fakeSupabaseModule);

import { submitApplication } from "./mutations";
import { applicantQuery } from "./queries";
import type { ApplicationInput } from "./schema";

const input = {
  email: "rosa@x.test",
  fullName: "Rosa Diaz",
  neighborhood: "Astoria",
  answers: { phone: "718-555-0100", basedIn: "Astoria" },
} as ApplicationInput;

const row = (userId: string | null) => ({
  email: "rosa@x.test", full_name: "Rosa Diaz", neighborhood: "Astoria", answers: input.answers, user_id: userId,
});
const session = (user: Record<string, unknown>) => ({ data: { session: { user } }, error: null });
const dbError = { code: "23514", message: "violates check constraint" };

beforeEach(() => fake.reset());

describe("submitApplication", () => {
  it("inserts an anonymous application with user_id null and never reads it back", async () => {
    fake.results = [{ data: { session: null }, error: null }, { data: null, error: null }];
    await submitApplication(input);
    expect(fake.calls).toEqual([["getSession"], ["from", "applications"], ["insert", row(null)]]);
    expect(fake.calls.some(([name]) => name === "select")).toBe(false);
  });

  it("links a signed-in applicant's application to her account", async () => {
    fake.results = [session({ id: "u1", email: "rosa@x.test" }), { data: null, error: null }];
    await submitApplication(input);
    expect(fake.calls).toEqual([["getSession"], ["from", "applications"], ["insert", row("u1")]]);
  });

  it("rejects with the insert error", async () => {
    fake.results = [{ data: { session: null }, error: null }, { data: null, error: dbError }];
    await expect(submitApplication(input)).rejects.toBe(dbError);
  });
});

describe("applicantQuery", () => {
  const run = () => (applicantQuery.queryFn as (c: unknown) => Promise<unknown>)({});

  it("is keyed ['applicant'] and returns null when signed out", async () => {
    expect(applicantQuery.queryKey).toEqual(["applicant"]);
    fake.results = [{ data: { session: null }, error: null }];
    expect(await run()).toBeNull();
  });

  it("uses the name from the account metadata", async () => {
    fake.results = [session({ id: "u1", email: "rosa@x.test", user_metadata: { full_name: "Rosa Diaz" } })];
    expect(await run()).toEqual({ email: "rosa@x.test", fullName: "Rosa Diaz" });
    expect(fake.calls).toEqual([["getSession"]]);
  });

  it("falls back to the profile name, and to no name when the profile can't be read", async () => {
    fake.results = [session({ id: "u1", email: "rosa@x.test", user_metadata: {} }), { data: { full_name: "Rosa D." }, error: null }];
    expect(await run()).toEqual({ email: "rosa@x.test", fullName: "Rosa D." });
    expect(fake.calls).toEqual([["getSession"], ["from", "profiles"], ["select", "full_name"], ["eq", "id", "u1"], ["maybeSingle"]]);
    fake.reset();
    fake.results = [session({ id: "u1", email: "rosa@x.test" }), { data: null, error: dbError }];
    expect(await run()).toEqual({ email: "rosa@x.test", fullName: "" });
  });
});
