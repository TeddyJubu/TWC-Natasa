import { beforeEach, describe, expect, it, vi } from "vitest";
import { fake } from "@/test/fake-fns";

vi.mock("@/features/applications/fns", async (orig) => (await import("@/test/fake-fns")).fakeFns(orig));
vi.mock("@/app/api", async () => (await import("@/test/fake-fns")).fakeApi);

import { submitApplication } from "./mutations";
import { applicantQuery } from "./queries";
import type { ApplicationInput } from "./schema";

const input = {
  email: "rosa@x.test",
  fullName: "Rosa Diaz",
  neighborhood: "Astoria",
  answers: { phone: "718-555-0100", basedIn: "Astoria" },
} as ApplicationInput;

beforeEach(() => fake.reset());

describe("submitApplication", () => {
  it("sends the application (the server links it to a signed-in applicant) and reads nothing back", async () => {
    fake.results = [undefined];
    expect(await submitApplication(input)).toBeUndefined();
    expect(fake.calls).toEqual([["/api/applications", input]]);
  });

  it("rejects with the server's error", async () => {
    fake.results = [new Error("Some details aren’t valid.")];
    await expect(submitApplication(input)).rejects.toThrow("Some details aren’t valid.");
  });
});

describe("applicantQuery", () => {
  const run = () => (applicantQuery.queryFn as (c: unknown) => Promise<unknown>)({});

  it("is keyed ['applicant'] and returns the server's prefill (null when signed out)", async () => {
    expect(applicantQuery.queryKey).toEqual(["applicant"]);
    fake.results = [null, { email: "rosa@x.test", fullName: "Rosa Diaz" }];
    expect(await run()).toBeNull();
    expect(await run()).toEqual({ email: "rosa@x.test", fullName: "Rosa Diaz" });
    expect(fake.calls).toEqual([["applicantFn"], ["applicantFn"]]);
  });
});
