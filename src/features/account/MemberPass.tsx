import * as React from "react";
import { Dialog, DialogClose, DialogContent } from "@ui-sdk/react/dialog";
import { cn, formatCatalogueNumber, initials } from "@/index";
import { useSaveProfile } from "@/features/members/mutations";
import { CARD_COLORS, type CardColor } from "@/features/members/card-colors";
import { secondaryButton } from "@/app/layout/app-classes";
import { Icon } from "@/app/layout/icons";
import { errorMessage } from "./helpers";

/** What the pass shows: her card as it stands (unsaved edits included), and only facts she or an admin set. */
export type PassFacts = {
  full_name: string; role_title: string; business: string; specialty: string; neighborhood: string | null;
  catalogue_number: number | null; member_since: string | null; card_color: CardColor; approved: boolean; avatar?: string;
};

const NY = "America/New_York";
const date = (iso: string, o: Intl.DateTimeFormatOptions) => new Date(iso).toLocaleDateString("en-US", { timeZone: NY, ...o });
const COLOR_NAMES: Record<CardColor, string> = { mustard: "Mustard", rose: "Rose", lilac: "Lilac", mint: "Mint" };
/** How many characters the name's size must fit across: its longest word, or more for a name long enough to run tall. */
const nameChars = (name: string) =>
  Math.max(...name.split(/[\s-]+/).map((word) => word.length), Math.ceil(1.3 * Math.sqrt(name.length)));

/**
 * "View directory card": her member card in a modal ui-sdk Dialog — side by side on wide screens, stacked below —
 * with the colour swatches under it. A swatch saves on the spot; the pass shows the choice straight away.
 */
export function PassDialog({ open, onClose, userId, facts }: { open: boolean; onClose: () => void; userId: string; facts: PassFacts }) {
  const save = useSaveProfile(userId);
  const color = save.isPending ? save.variables.card_color ?? facts.card_color : facts.card_color;
  const nameId = React.useId();

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
    <DialogContent aria-labelledby={nameId} className="pass-dialog">
      <div className="pass-dialog-in">
        <DialogClose className={cn(secondaryButton, "pass-close")}>
          Close<span className="sr-only"> your directory card</span>
        </DialogClose>
        <MemberPass facts={{ ...facts, card_color: color }} nameId={nameId} />
        <fieldset className="pass-colors">
          <legend>Card colour</legend>
          {CARD_COLORS.map((c) => (
            <label key={c} className={cn("pass-swatch", `pass--${c}`)}>
              <input
                type="radio" name="pass-color" value={c} checked={color === c} disabled={save.isPending}
                onChange={() => save.mutate({ card_color: c })}
              />
              <span className="sr-only">{COLOR_NAMES[c]}</span>
            </label>
          ))}
          {save.isError && <p role="alert" className="pass-error">{errorMessage(save.error)}</p>}
        </fieldset>
      </div>
    </DialogContent>
    </Dialog>
  );
}

/** Her card as the canvas's profile dialog: her colour, her portrait (or initials), her name and only the facts that are set. */
function MemberPass({ facts: f, nameId }: { facts: PassFacts; nameId: string }) {
  const number = f.approved && f.catalogue_number !== null ? formatCatalogueNumber(f.catalogue_number) : null;
  const since = f.approved ? f.member_since : null;
  const hood = f.neighborhood || null;
  const name = f.full_name || "Your name";
  const work = [f.role_title, f.business].map((s) => s.trim()).filter(Boolean).join(", ");
  const fields = [
    ...(hood ? [["Neighborhood", hood]] : []),
    ...(f.specialty.trim() ? [["Specialty", f.specialty.trim()]] : []),
    ...(number ? [["Member", `No. ${number}`]] : []),
    ...(since ? [["Joined", date(since, { month: "short", year: "numeric" })]] : []),
  ];

  return (
    <div className="pass-wrap">
      <article className={cn("pass", `pass--${f.card_color}`)} aria-labelledby={nameId}>
        <p className="pass-top"><span>The Women’s Collective · Member card</span></p>
        <div className="pass-photo">
          {f.avatar ? <img src={f.avatar} alt="" /> : <span aria-hidden className="pass-initials">{initials(f.full_name)}</span>}
          {f.approved && <p className="pass-tab"><Icon name="badge-check" />Verified member</p>}
        </div>
        <div className="pass-stub">
          <h2 id={nameId} style={{ "--name-chars": nameChars(name) } as React.CSSProperties}>{name}</h2>
          {work && <p className="pass-role">{work}</p>}
          {fields.length > 0 && (
            <dl className="pass-grid">
              {fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
            </dl>
          )}
        </div>
      </article>
    </div>
  );
}
