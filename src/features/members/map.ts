import type { MemberProfile } from "@/index";
import hero from "@/assets/photography/hero.jpg";

/** The fields of a profile or public_directory row that a member card needs. */
export type MemberRow = {
  id: string;
  full_name: string;
  role_title: string;
  business: string;
  neighborhood: string | null;
  specialty: string;
  bio: string;
  looking_for: string;
  catalogue_number: number | null;
  website?: string | null;
};

/**
 * Maps a row to a card profile; `placeholders` fills empty fields for the account preview.
 * No neighborhood (null) becomes "", which the card leaves out.
 */
export function toMemberProfile(row: MemberRow, opts: { image?: string; placeholders?: boolean } = {}): MemberProfile {
  const fill = (value: string, placeholder: string) => (opts.placeholders ? value || placeholder : value);
  return {
    id: row.id,
    name: fill(row.full_name, "Your name"),
    role: fill(row.role_title, "Your role"),
    business: fill(row.business, "Your business"),
    neighborhood: row.neighborhood ?? "",
    specialty: fill(row.specialty, "Your specialty"),
    bio: row.bio,
    lookingFor: row.looking_for,
    image: opts.image ?? hero,
    imageAlt: `Portrait of ${opts.placeholders ? row.full_name || "member" : row.full_name}`,
    catalogueNumber: row.catalogue_number ?? undefined,
    website: row.website || undefined,
  };
}

export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "TWC";
}
