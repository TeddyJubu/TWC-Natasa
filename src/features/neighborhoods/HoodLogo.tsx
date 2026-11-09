import { ConstellationLogo, cn } from "@/index";
import type { Neighborhood } from "./queries";
import { hasColor, toneFor } from "./tone";

/**
 * A neighborhood's mark on a paper disc: its uploaded or bundled logo, else the ink constellation. A neighborhood
 * with no color yet gets a dashed ring instead of the disc. Decorative: the name is always next to it.
 */
export function HoodLogo({ hood, className }: { hood: Neighborhood; className?: string }) {
  const src = toneFor(hood.name, [hood])?.logoSrc;
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-full p-2",
        hasColor(hood.color) ? "bg-sb-paper" : "border-[1.5px] border-dashed border-sb-ink/35",
        className,
      )}
    >
      {src ? <img src={src} alt="" className="size-full object-contain" /> : <ConstellationLogo alt="" className="size-full" />}
    </span>
  );
}
