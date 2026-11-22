import { Link } from "@tanstack/react-router";
import { AREAS, type Area } from "./schema";

/** What plain /join shows first: one link per area, so it works before the page's script has loaded. */
export function AreaChoice() {
  return (
    <section aria-labelledby="area-title" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 id="area-title" className="twc-h3">Which area is yours?</h2>
        <p className="max-w-[60ch] text-[17px] leading-[1.6] text-sb-muted">Choose where you live, work or run your business. The application is the same for both.</p>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2">
        {AREAS.map((a) => (
          <li key={a.id} className="flex">
            <Link
              to="/join"
              search={{ area: a.id }}
              className="flex w-full flex-col gap-2 rounded-[6px] bg-sb-cream p-6 text-sb-ink transition-[translate] duration-300 ease-[var(--ease-snap)] hover:-translate-y-1 hover:text-sb-ink focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-sb-blue-ink motion-reduce:transform-none"
            >
              <span className="font-display text-[34px] leading-[1.1]">{a.name} <span className="twc-arrow" aria-hidden>→</span></span>
              <span className="text-[15px] leading-[1.5] text-sb-muted">{a.neighborhoods.join(", ")} and nearby</span>
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
