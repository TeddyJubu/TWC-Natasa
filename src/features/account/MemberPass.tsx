import * as React from "react";
import { ConstellationLogo, cn, formatCatalogueNumber, initials } from "@/index";
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
const date = (iso: string, o: Intl.DateTimeFormatOptions) => new Date(iso).toLocaleDateString("en-US", { timeZone: NY, ...o }).toUpperCase();
const COLOR_NAMES: Record<CardColor, string> = { mustard: "Mustard", rose: "Rose", lilac: "Lilac", mint: "Mint" };
// Pointer tilt and foil only where there is a hovering pointer and motion is welcome.
const TILT = "(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)";

/**
 * "View public card": her member pass in a native modal <dialog> — landscape on wide screens, portrait below —
 * with the colour swatches under it. A swatch saves on the spot; the pass shows the choice straight away.
 */
export function PassDialog({ open, onClose, userId, facts }: { open: boolean; onClose: () => void; userId: string; facts: PassFacts }) {
  const ref = React.useRef<HTMLDialogElement>(null);
  const save = useSaveProfile(userId);
  const color = save.isPending ? save.variables.card_color ?? facts.card_color : facts.card_color;
  const nameId = React.useId();

  React.useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref} aria-labelledby={nameId} className="pass-dialog"
      onClose={onClose} onCancel={(e) => { e.preventDefault(); onClose(); }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="pass-dialog-in">
        <button type="button" onClick={onClose} className={cn(secondaryButton, "pass-close")}>
          Close<span className="sr-only"> your public card</span>
        </button>
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
    </dialog>
  );
}

function MemberPass({ facts: f, nameId }: { facts: PassFacts; nameId: string }) {
  const wrap = React.useRef<HTMLDivElement>(null);
  const number = f.approved && f.catalogue_number !== null ? formatCatalogueNumber(f.catalogue_number) : null;
  const since = f.approved ? f.member_since : null;
  const hood = f.neighborhood || null;
  const work = [f.role_title, f.business].map((s) => s.trim()).filter(Boolean).join(", ");
  const ringText = `${(f.business.trim() || f.full_name).toUpperCase()} · MEMBER POST · `;
  const fields = [
    ...(hood ? [["Neighborhood", hood]] : []),
    ...(f.specialty.trim() ? [["Specialty", f.specialty.trim()]] : []),
    ...(number ? [["Member", `No. ${number}`]] : []),
  ];

  // The tilt and foil follow the pointer through --px/--py (runtime values no utility can express).
  function move(e: React.PointerEvent<HTMLDivElement>) {
    const el = wrap.current;
    if (!el || !matchMedia(TILT).matches) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--px", Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100)).toFixed(2));
    el.style.setProperty("--py", Math.min(100, Math.max(0, ((e.clientY - r.top) / r.height) * 100)).toFixed(2));
  }
  function leave() {
    wrap.current?.style.removeProperty("--px");
    wrap.current?.style.removeProperty("--py");
  }

  return (
    <div ref={wrap} className="pass-wrap" onPointerMove={move} onPointerLeave={leave}>
      <article className={cn("pass", `pass--${f.card_color}`)} aria-labelledby={nameId}>
        <p className="pass-top"><b>Member pass</b>{since && <span>Valid · {date(since, { month: "short", year: "numeric" })}</span>}</p>
        <div className="pass-photo">
          {f.avatar ? <img src={f.avatar} alt="" /> : <span aria-hidden className="pass-initials">{initials(f.full_name)}</span>}
        </div>
        {f.approved && <p className="pass-tab"><Icon name="badge-check" />Verified member</p>}
        <svg aria-hidden viewBox="0 0 260 110" className="pass-postmark">
          <defs><path id={`${nameId}-ring`} d="M25 55 a30 30 0 1 1 60 0 a30 30 0 1 1 -60 0" /></defs>
          <g fill="none" stroke="currentColor">
            <circle cx="55" cy="55" r="47" strokeWidth="2.2" />
            <circle cx="55" cy="55" r="39" strokeWidth="1" />
            <g strokeWidth="2.4" strokeLinecap="round">
              {[34, 48, 62, 76].map((y) => <path key={y} d={`M110 ${y} q12.5 -8 25 0 t25 0 t25 0 t25 0 t25 0 t25 0`} />)}
            </g>
          </g>
          <g fill="currentColor" fontFamily="var(--font-geist)" fontWeight="600">
            <text fontSize="7.5" letterSpacing="1.6"><textPath href={`#${nameId}-ring`}>{ringText}</textPath></text>
            {since && <text x="55" y="54" textAnchor="middle" fontSize="13" letterSpacing="1">{date(since, { day: "numeric" })} {date(since, { month: "short" })}</text>}
            {since && <text x="55" y="67" textAnchor="middle" fontSize="9" letterSpacing="1.5">{date(since, { year: "numeric" })}</text>}
          </g>
        </svg>
        <div aria-hidden className="pass-stamp">
          <div className="pass-stamp-paper">
            <div className="pass-stamp-face">
              <span className="pass-stamp-val">{number ? `${Number(f.catalogue_number)}¢` : ""}</span>
              <ConstellationLogo variant="white" alt="" className="w-7" />
              <span className="pass-stamp-name">{f.specialty.trim()}</span>
              <span className="pass-stamp-foot">{hood ? `${hood} post` : ""}</span>
            </div>
          </div>
        </div>
        <div aria-hidden className="pass-perf" />
        <div className="pass-stub">
          <h2 id={nameId}>{f.full_name || "Your name"}</h2>
          {work && <p className="pass-role">{work}</p>}
          {fields.length > 0 && (
            <dl className="pass-grid">
              {fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
            </dl>
          )}
          {number && (
            <div aria-hidden className="pass-code">
              <div className="pass-bars" />
              <span>WC-{number}{hood ? `-${hood.replace(/[^a-z]/gi, "").slice(0, 3).toUpperCase()}` : ""}</span>
            </div>
          )}
        </div>
        <div aria-hidden className="pass-shine" />
        <div aria-hidden className="pass-glare" />
      </article>
    </div>
  );
}
