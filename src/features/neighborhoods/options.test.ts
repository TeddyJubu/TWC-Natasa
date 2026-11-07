import { describe, expect, it } from "vitest";
import type { Neighborhood } from "./queries";
import { pickerNames } from "./options";

const hood = (name: string, active: boolean): Neighborhood => ({ slug: name.toLowerCase(), name, color: "#123456", logoUrl: null, active });
const list = [hood("Astoria", true), hood("Rego Park", false), hood("Sunnyside", true)];

describe("pickerNames", () => {
  it("offers only active neighborhoods, in list order", () => {
    expect(pickerNames(list)).toEqual(["Astoria", "Sunnyside"]);
  });

  it("keeps a current value that is inactive or unknown, once, after the active ones", () => {
    expect(pickerNames(list, "Rego Park")).toEqual(["Astoria", "Sunnyside", "Rego Park"]);
    expect(pickerNames(list, ["Rego Park", "Woodside", "Astoria", "Rego Park", ""])).toEqual(["Astoria", "Sunnyside", "Rego Park", "Woodside"]);
  });
});
