import * as React from "react";
import { Link } from "@tanstack/react-router";
import { cn, formatCatalogueNumber } from "@/index";
import type { Neighborhood } from "@/features/neighborhoods/queries";
import { pickerNames } from "@/features/neighborhoods/options";
import type { Profile } from "@/features/members/queries";
import { memberSlug } from "@/features/members/map";
import { useRemoveLogo, useUploadLogo } from "@/features/members/mutations";
import { fieldClass, linkClass } from "@/app/layout/app-classes";
import { Icon, type IconName } from "@/app/layout/icons";
import { Card, Chip, EditButton, Row, Toggle } from "@/app/layout/app-ui";
import { PROFILE_FORM, errorMessage, fieldId, monthYear, type ProfileEditor } from "./helpers";

type TextRow = {
  key: "full_name" | "role_title" | "business" | "specialty" | "website"; label: string; icon?: IconName; empty: string; max: number;
  placeholder?: string; type?: string; required?: boolean;
};
const WEBSITE: TextRow = { key: "website", label: "Website", icon: "globe", empty: "Optional", max: 200, placeholder: "https://", type: "url" };
const PUBLIC_ROWS: TextRow[] = [
  { key: "full_name", label: "Full name", empty: "Add your name", max: 80, required: true },
  { key: "role_title", label: "Role", empty: "No role added", max: 80, placeholder: "Founder & Designer" },
  { key: "business", label: "Business", icon: "briefcase", empty: "No business added", max: 80 },
  { key: "specialty", label: "Specialty", icon: "utensils", empty: "No specialty added", max: 60, placeholder: "Food & hospitality" },
];

/** Name, work, neighborhood, website and logo: how neighbors see her in the directory. */
export function PublicCard({ editor, userId, logoPath, logoUrl, hoodList }: {
  editor: ProfileEditor; userId: string; logoPath: string | null; logoUrl?: string; hoodList: Neighborhood[];
}) {
  const { card, set, add } = editor;
  const editing = editor.isEditing("public");
  const text = (row: TextRow) => {
    const value = card[row.key];
    return (
      <Row
        key={row.key}
        label={row.label}
        htmlFor={editing ? fieldId(row.key) : undefined}
        icon={row.icon}
        empty={!editing && !value.trim()}
        add={!editing && !value.trim() && row.key !== "full_name" ? { field: row.label.toLowerCase(), onClick: () => add("public", row.key) } : undefined}
      >
        {editing ? (
          <input
            id={fieldId(row.key)} form={PROFILE_FORM} name={row.key} value={value} maxLength={row.max} placeholder={row.placeholder}
            type={row.type ?? "text"} required={row.required} className={fieldClass}
            onChange={(e) => set({ [row.key]: e.currentTarget.value })}
          />
        ) : value.trim() || row.empty}
      </Row>
    );
  };
  const hood = card.neighborhood;
  // Active neighborhoods, plus hers if an admin has since deactivated it.
  const options = pickerNames(hoodList, hood ?? []);

  return (
    <Card id="public-card" title="Public card" subtitle="How neighbors see you in the member directory" action={<EditButton card="public card" editing={editing} onClick={() => editor.toggle("public")} />}>
      {PUBLIC_ROWS.map(text)}
      <Row
        label="Neighborhood" htmlFor={editing ? fieldId("neighborhood") : undefined} icon="map-pin" empty={!editing && !hood}
        add={!editing && !hood ? { field: "neighborhood", onClick: () => add("public", "neighborhood") } : undefined}
      >
        {editing ? (
          <select id={fieldId("neighborhood")} form={PROFILE_FORM} value={hood ?? ""} className={fieldClass} onChange={(e) => set({ neighborhood: e.currentTarget.value || null })}>
            <option value="">Choose your neighborhood</option>
            {options.map((x) => <option key={x}>{x}</option>)}
          </select>
        ) : hood || "Not chosen yet"}
      </Row>
      {text(WEBSITE)}
      <LogoRow userId={userId} path={logoPath} url={logoUrl} business={card.business || card.full_name} />
    </Card>
  );
}

/** Optional business logo, shown in her profile dialog; uploaded or removed on the spot, like the portrait. */
function LogoRow({ userId, path, url, business }: { userId: string; path: string | null; url?: string; business: string }) {
  const upload = useUploadLogo(userId);
  const remove = useRemoveLogo(userId);
  const failed = upload.isError ? upload.error : remove.isError ? remove.error : null;
  const pick = (verb: string) => (
    <label className={cn(linkClass, "shrink-0 cursor-pointer has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-app-accent has-[:disabled]:opacity-50")}>
      {verb}<span className="sr-only"> business logo</span>
      <input
        type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={upload.isPending}
        onChange={(e) => { const file = e.currentTarget.files?.[0]; e.currentTarget.value = ""; if (file) upload.mutate(file); }}
      />
    </label>
  );
  return (
    <Row label="Business logo" icon="image" empty={!path}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {path ? (
          <>
            {url && <img src={url} alt={`${business} logo`} className="h-10 w-auto max-w-40 object-contain" />}
            <span className="ml-auto flex items-center gap-4">
              {pick("Replace")}
              <button type="button" disabled={remove.isPending} onClick={() => remove.mutate(path)} className={cn(linkClass, "text-ink-muted")}>
                Remove<span className="sr-only"> logo</span>
              </button>
            </span>
          </>
        ) : (
          <>
            <span className="flex-1 text-[13px]">Optional · JPG, PNG or WebP, up to 5 MB</span>
            {pick("Add")}
          </>
        )}
        {failed && <p role="alert" className="w-full text-sm text-danger">{errorMessage(failed)}</p>}
      </div>
    </Row>
  );
}

/** Bio and who she'd like to meet. */
export function WordsCard({ editor }: { editor: ProfileEditor }) {
  const { card, set } = editor;
  const editing = editor.isEditing("words");
  return (
    <Card title="In your words" subtitle="Short and warm beats long and formal" action={<EditButton card="in your words" editing={editing} onClick={() => editor.toggle("words")} />}>
      <Row label="Bio" htmlFor={editing ? fieldId("bio") : undefined} top empty={!editing && !card.bio.trim()}>
        {editing ? (
          <>
            <textarea id={fieldId("bio")} form={PROFILE_FORM} value={card.bio} maxLength={400} rows={4} aria-describedby="account-bio-count" className={fieldClass} onChange={(e) => set({ bio: e.currentTarget.value })} />
            <p id="account-bio-count" className="mt-1.5 text-right text-xs text-app-muted tabular-nums">{card.bio.length} of 400 characters</p>
          </>
        ) : (
          <p className="leading-[23px] whitespace-pre-line">{card.bio.trim() || "Tell neighbors what you make, who you make it for, and what brought you to the collective. Up to 400 characters."}</p>
        )}
      </Row>
      <Row label="Looking to meet" htmlFor={editing ? fieldId("looking_for") : undefined} empty={!editing && !card.looking_for.trim()}>
        {editing ? (
          <input id={fieldId("looking_for")} form={PROFILE_FORM} value={card.looking_for} maxLength={160} placeholder="Retail partners and fellow makers" className={fieldClass} onChange={(e) => set({ looking_for: e.currentTarget.value })} />
        ) : card.looking_for.trim() || "Who you’d love an introduction to"}
      </Row>
    </Card>
  );
}

/** Status, catalogue number and member since: read-only, set by admins. */
export function MembershipCard({ profile }: { profile: Profile }) {
  const approved = profile.status === "approved";
  const declined = profile.status === "declined";
  return (
    <Card title="Membership" subtitle="Your standing in the collective">
      <Row label="Status">
        {approved ? (
          <span className="inline-flex items-center gap-2">Approved <Chip tone="ok">Verified</Chip></span>
        ) : declined ? "Your application wasn’t approved this time" : "Your application is being reviewed"}
      </Row>
      <Row label="Catalogue number" empty={!approved}>
        {approved && profile.catalogue_number !== null ? `No. ${formatCatalogueNumber(profile.catalogue_number)}` : declined ? "—" : "Assigned once you’re approved"}
      </Row>
      <Row label="Member since" empty={!approved || !profile.member_since}>{(approved && monthYear(profile.member_since)) || "—"}</Row>
    </Card>
  );
}

/**
 * Directory and public-website switches; they mark the page unsaved like any other field. The subtitle says in one
 * plain sentence who can see her card with the switches as they stand, and a saved, live public page gets its link.
 */
export function VisibilityCard({ editor, profile }: { editor: ProfileEditor; profile: Profile }) {
  const { card, set } = editor;
  const listed = card.directory_visible;
  const approved = profile.status === "approved";
  const audience = profile.status === "declined"
    ? "Your card stays private and isn’t shown to anyone."
    : !approved
      ? "Your card stays private until you’re welcomed in. These choices take effect that day."
      : listed && card.public_profile
        ? "Anyone can see your card: members, and visitors to the public website."
        : listed
          ? "Only members of the collective can see your card."
          : "Only you and the collective’s admins can see your card.";
  const slug = approved && profile.directory_visible && profile.public_profile && profile.catalogue_number !== null
    ? memberSlug({ name: profile.full_name, catalogueNumber: profile.catalogue_number })
    : undefined;
  return (
    <Card id="visibility" title="Visibility" subtitle={audience}>
      <Toggle
        label="Show me in the member directory"
        description={approved ? "Signed-in members can find you and your card." : "Signed-in members can find you and your card, once your membership is approved."}
        checked={listed}
        // Switching the directory off also switches the public card off, so re-listing never republishes silently.
        onChange={(e) => set(e.currentTarget.checked ? { directory_visible: true } : { directory_visible: false, public_profile: false })}
      />
      <Toggle
        label="Show my profile on the public website"
        description={`Anyone on the internet can see your name, portrait, work, neighborhood, bio and links, on our homepage and your public page.${listed ? "" : " Turn on the member directory first."}${approved ? "" : " Goes live only once you’re approved."}`}
        checked={listed && card.public_profile} disabled={!listed}
        onChange={(e) => set({ public_profile: e.currentTarget.checked })}
      />
      {slug && (
        <Row label="Your public page" icon="globe">
          <Link to="/members/$slug" params={{ slug }} className={cn(linkClass, "inline-flex items-center gap-1.5")}>
            /members/{slug}<Icon name="external-link" className="size-3.5" />
          </Link>
        </Row>
      )}
    </Card>
  );
}
