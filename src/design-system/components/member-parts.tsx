// Internal pieces shared by MemberCard and MemberDialog; not re-exported from the barrel.
import type { MemberProfile } from "./member-card";
import { cn, formatCatalogueNumber, initials } from "../lib/utils";

/**
 * The portrait, or, without one, the member's initials on a neutral mat in the same box. The mat is
 * aria-hidden: the card heading already names the member, and initials are no portrait to describe.
 */
export function Portrait({ member, imgClassName, initialsClassName }: { member: MemberProfile; imgClassName: string; initialsClassName: string }) {
  if (!member.image) {
    return (
      <div aria-hidden="true" className={cn("absolute inset-0 grid place-items-center font-display leading-none select-none", initialsClassName)}>
        {initials(member.name)}
      </div>
    );
  }
  return <img src={member.image} alt={member.imageAlt ?? ""} loading="lazy" width={768} height={1024} className={imgClassName} />;
}

/**
 * "● Nº 07 · Astoria" in small mono caps; the dot is the `--hood` colour set by the card (or dialog) above it.
 * Shared by the polaroid card and the polaroid `MemberDialog`.
 */
export function PolaroidMeta({ member, catalogueNumber, toned }: { member: MemberProfile; catalogueNumber?: number; toned: boolean }) {
  if (catalogueNumber === undefined && !member.neighborhood) return null;
  return (
    <p className="flex flex-wrap items-center gap-2 font-mono text-xs uppercase leading-4 tracking-[1px] text-ink-muted">
      {toned && <span aria-hidden className="size-2.5 shrink-0 rounded-full bg-(--hood)" />}
      {catalogueNumber !== undefined && <span aria-label={`Catalogue number ${catalogueNumber}`}>Nº {formatCatalogueNumber(catalogueNumber)}</span>}
      {catalogueNumber !== undefined && member.neighborhood && <span aria-hidden>·</span>}
      {member.neighborhood && <span>{member.neighborhood}</span>}
    </p>
  );
}
