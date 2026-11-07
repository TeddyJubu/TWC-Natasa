import { describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { handleAuthEvent } from "./auth-events";

const setup = () => {
  const qc = new QueryClient();
  qc.setQueryData(["viewer"], { signedIn: true, member: true });
  qc.setQueryData(["directory"], [{ id: "u1" }]);
  return { qc, router: vi.fn() };
};

describe("handleAuthEvent", () => {
  it("on sign-out drops the members-only directory and resets the viewer", () => {
    const { qc, router } = setup();
    handleAuthEvent("SIGNED_OUT", qc, router);
    expect(router).toHaveBeenCalledOnce();
    expect(qc.getQueryData(["directory"])).toBeUndefined();
    expect(qc.getQueryData(["viewer"])).toBeUndefined();
  });

  it.each(["SIGNED_IN", "USER_UPDATED"])("on %s invalidates every query", (event) => {
    const { qc, router } = setup();
    const spy = vi.spyOn(qc, "invalidateQueries");
    handleAuthEvent(event, qc, router);
    expect(router).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith();
  });

  it("ignores token refreshes", () => {
    const { qc, router } = setup();
    handleAuthEvent("TOKEN_REFRESHED", qc, router);
    expect(router).not.toHaveBeenCalled();
    expect(qc.getQueryData(["viewer"])).toEqual({ signedIn: true, member: true });
  });
});
