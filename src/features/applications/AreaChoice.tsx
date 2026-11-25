import { Link } from "@tanstack/react-router";
import { AREAS, type Area } from "./schema";

/** Each area's colour field: its constellation band colour from the canvas (North Brooklyn lime, Queens purple). */
const FIELD: Record<string, string> = { "north-brooklyn": "twc-c-band-lime", queens: "twc-c-band-purple" };

/** What plain /join shows first: one link per area, so it works before the page's script has loaded. */
export function AreaChoice() {
  return (
    <section aria-labelledby="area-title" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 id="area-title" className="twc-h3">Which area is yours?</h2>
        <p className="twc-lede">Choose where you live, work or run your business. The application is the same for both.</p>
      </div>
      <ul className="grid sm:grid-cols-2">
        {AREAS.map((a, i) => (
          <li key={a.id} className="flex">
            <Link to="/join" search={{ area: a.id }} className={`twc-farea w-full ${FIELD[a.id] ?? "twc-c-stone"}`}>
              <span aria-hidden className="twc-fmono">{String(i + 1).padStart(2, "0")}</span>
              <span className="flex flex-col gap-3">
                <span className="twc-farea__name">{a.name} <span className="twc-arrow" aria-hidden>→</span></span>
                <span className="text-[15px] leading-[1.5]">{a.neighborhoods.join(", ")} and nearby</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Above the form: the area it's for, and the other one. The form stays mounted, so her answers stay too. */
export function AreaSwitch({ area }: { area: Area }) {
  return (
    <p className="text-[15px] text-sb-muted">
      Applying in <b className="font-semibold text-sb-ink">{area.name}</b>.{" "}
      {AREAS.filter((a) => a.id !== area.id).map((a) => (
        <Link key={a.id} to="/join" search={{ area: a.id }} replace className="twc-inlink">Switch to {a.name}</Link>
      ))}
    </p>
  );
}
