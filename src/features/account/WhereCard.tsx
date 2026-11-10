import { useQuery } from "@tanstack/react-query";
import { cn, formatCatalogueNumber, initials } from "@/index";
import type { Neighborhood } from "@/features/neighborhoods/queries";
import { PLACES, formatCoords } from "@/features/neighborhoods/places";
import { eventsQuery } from "@/features/events/queries";
import { introsQuery } from "@/features/members/queries";
import { ring } from "@/app/layout/app-classes";
import { Icon } from "@/app/layout/icons";
import type { ProfileEditor } from "./helpers";
import { AirCard, AirEdit, EmptySlot } from "./shared";
import { NeighborhoodMap } from "./NeighborhoodMap";

/**
 * Her pin on the collective's map: the neighborhood's centre (never an address), its post (ZIP, nearest stop), where
 * it gathers and how many listed neighbors live there. Shows what is saved; Edit opens the Public card's neighborhood
 * picker, the one place it is chosen. Rows whose facts we don't have are dropped.
 */
export function WhereCard({ editor, userId, hood, approved, avatar, hoodList }: {
  editor: ProfileEditor; userId: string; hood: string | null; approved: boolean; avatar?: string; hoodList: Neighborhood[];
}) {
  const { card } = editor;
  const slug = hoodList.find((h) => h.name === hood)?.slug;
  const place = slug ? PLACES[slug] : undefined;
  // Both share their cards' caches (Gatherings, Introductions); members only, like those cards.
  const events = useQuery({ ...eventsQuery, enabled: approved && !!hood }).data ?? [];
  const intros = useQuery({ ...introsQuery(userId, hood), enabled: approved && !!hood }).data;
  const gathersAt = events.find((e) => e.neighborhood === hood)?.location;
  // Introductions return at most four, so four means "four or more".
  const near = intros?.filter((m) => m.neighborhood === hood).length;
  const neighbors = near === undefined ? null : near === 0 ? "Just you, for now" : near >= 4 ? "4+ neighbors" : `${near} neighbor${near === 1 ? "" : "s"}`;
  const edit = <AirEdit card="neighborhood" editing={false} onClick={() => editor.add("public", "neighborhood")} />;
  const work = [card.business, card.specialty].filter((s) => s.trim()).join(" · ");

  if (!hood) {
    return (
      <AirCard id="where" no={1} title="Where you belong" subtitle="Your pin on the collective’s map of neighbors" action={edit}>
        <EmptySlot icon="map-pin">
          <p className="air-empty-title">No neighborhood yet</p>
          <p>Choose yours and your pin goes on the map, next to the neighbors you’ll meet first.</p>
          <button type="button" onClick={() => editor.add("public", "neighborhood")} className={cn("air-link", ring)}>Choose your neighborhood</button>
        </EmptySlot>
      </AirCard>
    );
  }

  return (
    <AirCard id="where" no={1} title="Where you belong" subtitle="Your pin on the collective’s map of neighbors" action={edit}>
      <div className={cn("air-where", !place && "air-where--nomap")}>
        {place && (
          <NeighborhoodMap center={place.center} label={hood}>
            <svg aria-hidden viewBox="0 0 220 104" className="air-map-mark">
              <defs><path id="air-mring" d="M21 52 a31 31 0 1 1 62 0 a31 31 0 1 1 -62 0" /></defs>
              <g fill="none" stroke="var(--bl-air-red)">
                <circle cx="52" cy="52" r="46" strokeWidth="2.2" /><circle cx="52" cy="52" r="39" strokeWidth="1" />
                <g strokeWidth="2.2" strokeLinecap="round">
                  {[31, 45, 59, 73].map((y) => <path key={y} d={`M104 ${y} q11 -7 22 0 t22 0 t22 0 t22 0 t22 0`} />)}
                </g>
              </g>
              <text fontFamily="var(--font-plex)" fontSize="6.8" fontWeight="600" letterSpacing="1.45" fill="var(--bl-air-red)">
                <textPath href="#air-mring">{hood.toUpperCase()} · QUEENS · NEW YORK ·</textPath>
              </text>
              <text x="52" y="57" textAnchor="middle" fontFamily="var(--font-fraunces)" fontSize="13.5" fontWeight="700" fill="var(--bl-air-red)">{place.zip}</text>
            </svg>
            <div className="air-map-pin">
              <div className="air-map-pop">
                {approved && card.catalogue_number !== null && <span className="air-lbl text-air-red">Member No. {formatCatalogueNumber(card.catalogue_number)}</span>}
                <b>{card.full_name}</b>
                {work && <small>{work}</small>}
              </div>
              <div aria-hidden className="air-map-pulse" />
              <div aria-hidden className="air-map-face">{avatar ? <img src={avatar} alt="" /> : initials(card.full_name)}</div>
            </div>
            <p aria-hidden className="air-map-hood"><Icon name="map-pin" className="size-3" />{hood} · {place.zip}</p>
          </NeighborhoodMap>
        )}
        <div className="air-post-col">
          <span className="air-lbl">Home post</span>
          <p className="air-post-name">{hood}</p>
          <p className="air-post-city">Queens, New York{place ? ` ${place.zip}` : ""}</p>
          {place && <p className="air-post-coords">{formatCoords(place.center)}</p>}
          <dl className="air-rule mt-5">
            {place && (
              <div className="air-mrow">
                <dt className="air-lbl">Nearest stop</dt>
                <dd className="flex items-center gap-1.5">
                  {place.stop}
                  <span className="sr-only">, {place.lines.join(", ")} {place.lines.length === 1 ? "train" : "trains"}</span>
                  {place.lines.map((l) => <span key={l} aria-hidden className="air-train">{l}</span>)}
                </dd>
              </div>
            )}
            {gathersAt && <div className="air-mrow"><dt className="air-lbl">Gathers at</dt><dd>{gathersAt}</dd></div>}
            {neighbors && <div className="air-mrow"><dt className="air-lbl">Neighbors here</dt><dd>{neighbors}</dd></div>}
          </dl>
          <p className="air-privacy"><Icon name="lock" className="size-4" />Shown by neighborhood only — never your address.</p>
        </div>
      </div>
    </AirCard>
  );
}
