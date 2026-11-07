import { describe, expect, it } from "vitest";
import { toMemberProfile, type MemberRow } from "./map";

const row: MemberRow = {
  id: "u1",
  full_name: "Rosa Diaz",
  role_title: "Founder",
  business: "Diaz Bakery",
  neighborhood: "Astoria",
  specialty: "Food",
  bio: "Bakes bread.",
  looking_for: "Suppliers",
  catalogue_number: 7,
  website: "https://diaz.example",
};

const blank: MemberRow = { ...row, full_name: "", role_title: "", business: "", specialty: "", catalogue_number: null, website: "" };

describe("toMemberProfile", () => {
  it("maps a directory row, carrying catalogueNumber and website", () => {
    expect(toMemberProfile(row, { image: "https://img/rosa.jpg" })).toEqual({
      id: "u1",
      name: "Rosa Diaz",
      role: "Founder",
      business: "Diaz Bakery",
      neighborhood: "Astoria",
      specialty: "Food",
      bio: "Bakes bread.",
      lookingFor: "Suppliers",
      image: "https://img/rosa.jpg",
      imageAlt: "Portrait of Rosa Diaz",
      catalogueNumber: 7,
      website: "https://diaz.example",
    });
  });

  it("leaves image and alt text undefined when there is no portrait (no stock photo stands in)", () => {
    const m = toMemberProfile(row);
    expect(m.image).toBeUndefined();
    expect(m.imageAlt).toBeUndefined();
    const preview = toMemberProfile(blank, { placeholders: true });
    expect(preview.image).toBeUndefined();
    expect(preview.imageAlt).toBeUndefined();
  });

  it("treats website as optional: missing, null or empty becomes undefined", () => {
    const { website: _omit, ...noWebsite } = row;
    expect(toMemberProfile(noWebsite).website).toBeUndefined();
    expect(toMemberProfile({ ...row, website: null }).website).toBeUndefined();
    expect(toMemberProfile({ ...row, website: "" }).website).toBeUndefined();
  });

  it("maps a profile with no neighborhood to an empty one", () => {
    expect(toMemberProfile({ ...row, neighborhood: null }).neighborhood).toBe("");
  });

  it("leaves a null catalogue number undefined", () => {
    expect(toMemberProfile(blank).catalogueNumber).toBeUndefined();
  });

  it("keeps a catalogue number of 0", () => {
    expect(toMemberProfile({ ...row, catalogue_number: 0 }).catalogueNumber).toBe(0);
  });

  it("adds no placeholders by default (directory)", () => {
    const m = toMemberProfile(blank);
    expect([m.name, m.role, m.business, m.specialty]).toEqual(["", "", "", ""]);
  });

  it("fills the account-preview placeholders when asked", () => {
    const m = toMemberProfile(blank, { image: "https://img/me.jpg", placeholders: true });
    expect([m.name, m.role, m.business, m.specialty]).toEqual(["Your name", "Your role", "Your business", "Your specialty"]);
    expect(m.imageAlt).toBe("Portrait of member");
  });
});
