import * as React from "react";
import {
  Button, Container, FileUpload, FormActions, FormField, FormSection, Input, MemberCard, Section, SectionHeader, Select, Switch, Textarea,
} from "@/index";
import type { Neighborhood } from "@/features/neighborhoods/queries";
import { pickerNames } from "@/features/neighborhoods/options";
import { toneFor } from "@/features/neighborhoods/tone";
import { toMemberProfile } from "@/features/members/map";
import type { Profile } from "@/features/members/queries";
import { useSaveProfile, useUploadAvatar, type ProfilePatch } from "@/features/members/mutations";
import { errorMessage } from "./helpers";

/**
 * The card fields as currently typed in the form (also the save patch). Unlisted means not public;
 * the blank neighborhood choice saves as null.
 */
function readCard(form: HTMLFormElement, profile: Profile): ProfilePatch {
  const f = new FormData(form);
  const text = (name: string) => String(f.get(name) ?? "").trim();
  const directory_visible = f.get("directory_visible") === "on";
  const neighborhood = f.get("neighborhood");
  return {
    full_name: text("full_name"), role_title: text("role_title"), business: text("business"),
    neighborhood: neighborhood === null ? profile.neighborhood : String(neighborhood) || null, specialty: text("specialty"),
    website: text("website"), bio: text("bio").slice(0, 400), looking_for: text("looking_for").slice(0, 160),
    directory_visible, public_profile: directory_visible && f.get("public_profile") === "on",
  };
}

/** 01 — the editable public card, its unsaved draft, and the live preview. */
export function PublicCardSection({
  userId, profile, avatar, neighborhood: n, hoodList,
}: {
  userId: string;
  profile: Profile;
  avatar?: string;
  /** Her neighborhood, or null when she hasn't chosen one. */
  neighborhood: string | null;
  hoodList: Neighborhood[];
}) {
  const save = useSaveProfile(userId);
  const upload = useUploadAvatar(userId);
  const [saved, setSaved] = React.useState(false);
  // Unsaved form edits; drives the preview and the public switch until the next save.
  const [draft, setDraft] = React.useState<ProfilePatch | null>(null);

  function saveProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const patch = readCard(e.currentTarget, profile);
    setSaved(false);
    save.mutate(patch, {
      // The draft stays: once the saved row matches it, it no longer counts as unsaved (and later typing survives).
      onSuccess: () => {
        setSaved(true);
        setTimeout(() => setSaved(false), 1800);
      },
    });
  }

  // Active neighborhoods, plus hers if an admin has since deactivated it.
  const neighborhoodOptions = pickerNames(hoodList, n ?? []);
  const card = { ...profile, ...draft };
  const unsaved = !!draft && Object.entries(draft).some(([key, value]) => profile[key as keyof Profile] !== value);
  const listed = card.directory_visible ?? profile.directory_visible;

  return (
    <Section>
      <Container className="flex flex-col gap-16">
        <SectionHeader badge="01 — Your public card" title="How Neighbors Will Meet You" intro="This is what appears in the member directory when you choose to be visible." />
        <div className="grid gap-14 lg:grid-cols-[1.4fr_0.8fr]">
          <form onSubmit={saveProfile} onChange={(e) => setDraft(readCard(e.currentTarget, profile))} className="flex flex-col gap-14">
            <FormSection index="A" title="The Basics" description="Your name and the work you’re known for.">
              <div className="grid gap-8 md:grid-cols-2">
                <FormField label="Full name" htmlFor="full_name" index="01"><Input name="full_name" defaultValue={profile.full_name} required maxLength={80} /></FormField>
                <FormField label="Role" htmlFor="role_title" index="02"><Input name="role_title" defaultValue={profile.role_title} maxLength={80} placeholder="Founder & Designer" /></FormField>
                <FormField label="Business" htmlFor="business" index="03"><Input name="business" defaultValue={profile.business} maxLength={80} /></FormField>
                <FormField label="Specialty" htmlFor="specialty" index="04"><Input name="specialty" defaultValue={profile.specialty} maxLength={60} placeholder="Food & hospitality" /></FormField>
                <FormField label="Neighborhood" htmlFor="neighborhood" index="05">
                  <Select name="neighborhood" defaultValue={n ?? ""}>
                    <option value="">Choose your neighborhood</option>
                    {neighborhoodOptions.map((x) => <option key={x}>{x}</option>)}
                  </Select>
                </FormField>
                <FormField label="Website" htmlFor="website" index="06" optional><Input name="website" type="url" defaultValue={profile.website} maxLength={200} placeholder="https://" /></FormField>
              </div>
            </FormSection>
            <FormSection index="B" title="In Your Words" description="Short and warm beats long and formal.">
              <div className="flex flex-col gap-8">
                <FormField label="Bio" htmlFor="bio" index="07" hint="Up to 400 characters."><Textarea name="bio" defaultValue={profile.bio} maxLength={400} /></FormField>
                <FormField label="Looking to meet" htmlFor="looking_for" index="08"><Input name="looking_for" defaultValue={profile.looking_for} maxLength={160} placeholder="Retail partners and fellow makers" /></FormField>
              </div>
            </FormSection>
            <FormSection index="C" title="Portrait & Visibility">
              <div className="grid gap-8 md:grid-cols-2">
                <div className="flex flex-col gap-3">
                  <FileUpload label="Upload a portrait" hint="JPG, PNG or WebP, up to 5 MB" accept="image/jpeg,image/png,image/webp" onChange={(e) => { const file = e.currentTarget.files?.[0]; e.currentTarget.value = ""; if (file) upload.mutate(file); }} />
                  {upload.isError && <p role="alert" className="text-sm text-danger">{errorMessage(upload.error)}</p>}
                </div>
                <div className="flex flex-col">
                  <Switch name="directory_visible" defaultChecked={profile.directory_visible} label="Show me in the member directory" description="Only appears once your membership is approved." />
                  {/* Controlled from the draft: switching the directory off also switches this off, so re-listing never republishes silently. */}
                  <Switch
                    name="public_profile"
                    checked={listed && (card.public_profile ?? false)}
                    onChange={() => undefined}
                    disabled={!listed}
                    className="border-t-0"
                    label="Show my profile on the public website"
                    description="Anyone on the internet can then see your card — name, portrait, work, neighborhood, bio and links — on our homepage and public member page. Needs “Show me in the member directory” on, and goes live only once you’re approved."
                  />
                </div>
              </div>
            </FormSection>
            {save.isError && <p role="alert" className="text-sm text-danger">{errorMessage(save.error)}</p>}
            <FormActions><Button type="submit" variant="ink" state={save.isPending ? "loading" : saved ? "success" : "idle"}>Save my card</Button></FormActions>
          </form>
          <aside aria-label="Card preview" className="lg:sticky lg:top-32 lg:self-start">
            <p className="mb-4 text-xs uppercase text-ink-muted">{unsaved ? "Preview · unsaved changes" : "Preview of your saved card"}</p>
            <div className="rounded-panel bg-black p-4">
              <MemberCard member={toMemberProfile({ ...profile, ...card }, { image: avatar, placeholders: true })} variant="catalogue" tone={toneFor(card.neighborhood ?? null, hoodList)} catalogueNumber={profile.catalogue_number ?? 0} />
            </div>
          </aside>
        </div>
      </Container>
    </Section>
  );
}
