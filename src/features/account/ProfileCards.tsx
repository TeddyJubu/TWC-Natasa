import * as React from "react";
import { Link } from "@tanstack/react-router";
import { ConstellationLogo, cn, formatCatalogueNumber } from "@/index";
import type { Neighborhood } from "@/features/neighborhoods/queries";
import { pickerNames } from "@/features/neighborhoods/options";
import type { Profile } from "@/features/members/queries";
import { memberSlug } from "@/features/members/map";
import { useRemoveLogo, useUploadLogo } from "@/features/members/mutations";
import { fieldClass, ring } from "@/app/layout/app-classes";
import { Icon, type IconName } from "@/app/layout/icons";
import { Toggle } from "@/app/layout/app-ui";
import { EditButton, Field, Letter } from "@/app/layout/app-ui";
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
      <Field
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
      </Field>
    );
  };
  const hood = card.neighborhood;
  // Active neighborhoods, plus hers if an admin has since deactivated it.
  const options = pickerNames(hoodList, hood ?? []);

  return (
    <Letter id="public-card" no={2} title="Public card" subtitle="How neighbors see you in the member directory" action={<EditButton card="public card" editing={editing} onClick={() => editor.toggle("public")} />}>
      <dl className="air-form">
      {PUBLIC_ROWS.map(text)}
      <Field
        label="Neighborhood" htmlFor={editing ? fieldId("neighborhood") : undefined} icon="map-pin" empty={!editing && !hood}
        add={!editing && !hood ? { field: "neighborhood", onClick: () => add("public", "neighborhood") } : undefined}
      >
        {editing ? (
          <select id={fieldId("neighborhood")} form={PROFILE_FORM} value={hood ?? ""} className={fieldClass} onChange={(e) => set({ neighborhood: e.currentTarget.value || null })}>
            <option value="">Choose your neighborhood</option>
            {options.map((x) => <option key={x}>{x}</option>)}
          </select>
        ) : hood || "Not chosen yet"}
      </Field>
      {text(WEBSITE)}
      <LogoRow userId={userId} path={logoPath} url={logoUrl} business={card.business || card.full_name} />
      </dl>
    </Letter>
  );
}

/** Optional business logo, shown in her profile dialog; uploaded or removed on the spot, like the portrait. */
function LogoRow({ userId, path, url, business }: { userId: string; path: string | null; url?: string; business: string }) {
  const upload = useUploadLogo(userId);
  const remove = useRemoveLogo(userId);
  const failed = upload.isError ? upload.error : remove.isError ? remove.error : null;
  const pick = (verb: string) => (
    <label className="air-link shrink-0 cursor-pointer has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink has-[:disabled]:opacity-50">
      {verb}<span className="sr-only"> business logo</span>
      <input
        type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={upload.isPending}
        onChange={(e) => { const file = e.currentTarget.files?.[0]; e.currentTarget.value = ""; if (file) upload.mutate(file); }}
      />
    </label>
  );
  return (
    <div className="air-cell air-cell--wide">
      <dt className="air-lbl">Business logo</dt>
      <dd className="flex min-w-0 flex-1 flex-wrap items-center gap-x-5 gap-y-2">
        {path ? (
          <>
            {url && <span className="air-logo"><img src={url} alt={`${business} logo`} /></span>}
            <span className="ml-auto flex items-center gap-5">
              {pick("Replace")}
              <button type="button" disabled={remove.isPending} onClick={() => remove.mutate(path)} className={cn("air-link", ring)}>
                Remove<span className="sr-only"> logo</span>
              </button>
            </span>
          </>
        ) : (
          <>
            <span className="flex-1 text-[13px] text-app-muted">Optional · JPG, PNG or WebP, up to 5 MB</span>
            {pick("Add")}
          </>
        )}
        {failed && <p role="alert" className="w-full text-sm text-danger">{errorMessage(failed)}</p>}
      </dd>
    </div>
  );
}

/** Bio and who she'd like to meet, as a letter on ruled paper. */
export function WordsCard({ editor, catalogueNumber }: { editor: ProfileEditor; catalogueNumber: number | null }) {
  const { card, set } = editor;
  const editing = editor.isEditing("words");
  return (
    <Letter span={7} no={3} title="In your words" subtitle="Short and warm beats long and formal" action={<EditButton card="in your words" editing={editing} onClick={() => editor.toggle("words")} />}>
      <div className="air-letter air-rule">
        <div className="min-w-0">
          {editing ? (
            <>
              <label htmlFor={fieldId("bio")} className="air-lbl">Bio</label>
              <textarea id={fieldId("bio")} form={PROFILE_FORM} value={card.bio} maxLength={400} rows={5} aria-describedby="account-bio-count" className={fieldClass} onChange={(e) => set({ bio: e.currentTarget.value })} />
              <p id="account-bio-count" className="mt-1.5 text-right text-xs text-app-muted tabular-nums">{card.bio.length} of 400 characters</p>
            </>
          ) : (
            <>
              <span className="air-lbl">Bio</span>
              <p className={cn("air-ruled-serif", !card.bio.trim() && "text-app-muted")}>
                {card.bio.trim() || "Tell neighbors what you make, who you make it for, and what brought you to the collective. Up to 400 characters."}
              </p>
            </>
          )}
        </div>
        <div className="air-to">
          <svg aria-hidden viewBox="0 0 130 40" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" className="air-waves">
            {[9, 20, 31].map((y) => <path key={y} d={`M2 ${y} q8 -6 16 0 t16 0 t16 0 t16 0 t16 0 t16 0 t16 0 t16 0`} />)}
          </svg>
          <div aria-hidden className="air-mini">
            <div><div className="air-mini-face">
              <span>{catalogueNumber !== null ? `${catalogueNumber}¢` : ""}</span>
              <ConstellationLogo variant="white" alt="" className="w-6.5" />
              <b>TWC</b>
            </div></div>
          </div>
          {editing ? (
            <>
              <label htmlFor={fieldId("looking_for")} className="air-lbl">Looking to meet</label>
              <input id={fieldId("looking_for")} form={PROFILE_FORM} value={card.looking_for} maxLength={160} placeholder="Retail partners and fellow makers" className={cn(fieldClass, "mt-2")} onChange={(e) => set({ looking_for: e.currentTarget.value })} />
            </>
          ) : (
            <>
              <span className="air-lbl">Looking to meet</span>
              <p className={cn("air-ruled", !card.looking_for.trim() && "font-medium text-app-muted")}>{card.looking_for.trim() || "Who you’d love an introduction to"}</p>
            </>
          )}
        </div>
      </div>
    </Letter>
  );
}

/** Status, catalogue number and member since: read-only, set by admins. The rubber stamp is decoration. */
export function MembershipCard({ profile }: { profile: Profile }) {
  const approved = profile.status === "approved";
  const declined = profile.status === "declined";
  const since = approved ? monthYear(profile.member_since) : null;
  return (
    <Letter span={5} no={4} title="Membership" subtitle="Your standing in the collective" className="[&_.air-ch]:pr-28">
      {approved && (
        <div aria-hidden className="air-rubber"><b>Approved</b>{since && <small>{since.replace(/^(\w{3})\w*/, "$1")}</small>}</div>
      )}
      <dl className="air-rule">
        <div className="air-catno">
          <dt className="air-lbl">Catalogue number</dt>
          {approved && profile.catalogue_number !== null
            ? <dd>No. {formatCatalogueNumber(profile.catalogue_number)}</dd>
            : <dd className="font-geist text-[15px] font-semibold tracking-normal text-app-muted">{declined ? "—" : "Assigned once you’re approved"}</dd>}
        </div>
        <div className="air-mrow">
          <dt className="air-lbl">Status</dt>
          <dd>
            {approved
              ? <>Approved <span className="air-chip">Verified</span></>
              : declined ? "Your application wasn’t approved this time" : "Your application is being reviewed"}
          </dd>
        </div>
        <div className="air-mrow">
          <dt className="air-lbl">Member since</dt>
          <dd className={cn(!since && "text-app-muted")}>{since || "—"}</dd>
        </div>
      </dl>
    </Letter>
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
    <Letter id="visibility" span={7} no={5} title="Visibility" subtitle={audience}>
      <div className="air-opts air-rule">
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
      </div>
      {slug && (
        <p className="air-mrow">
          <span className="air-lbl">Your public page</span>
          <Link to="/members/$slug" params={{ slug }} className={cn("air-link inline-flex items-center gap-1.5", ring)}>
            /members/{slug}<Icon name="external-link" className="size-3.5" />
          </Link>
        </p>
      )}
    </Letter>
  );
}
