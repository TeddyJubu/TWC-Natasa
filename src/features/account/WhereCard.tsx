import { useQuery } from "@tanstack/react-query";
import { cn, formatCatalogueNumber, initials } from "@/index";
import type { Neighborhood } from "@/features/neighborhoods/queries";
import { PLACES, formatCoords } from "@/features/neighborhoods/places";
import { areaOfPlace } from "@/features/applications/schema";
import { eventsQuery } from "@/features/events/queries";
import { introsQuery } from "@/features/members/queries";
import { ring } from "@/app/layout/app-classes";
import { Icon } from "@/app/layout/icons";
import type { ProfileEditor } from "./helpers";
import { EditButton, EmptySlot, Letter } from "@/app/layout/app-ui";
import { NeighborhoodMap } from "./NeighborhoodMap";

/**
 * Her pin on the collective's map: the neighborhood's centre (never an address), its post (ZIP, nearest stop), where
 * it gathers and how many listed neighbors live there. Shows what is saved; Edit opens the Directory card's neighborhood
 * picker, the one place it is chosen. Rows whose facts we don't have are dropped.
 */
export function WhereCard({ editor, userId, hood, approved, avatar, hoodList }: {
  editor: ProfileEditor; userId: string; hood: string | null; approved: boolean; avatar?: string; hoodList: Neighborhood[];
}) {
  const { card } = editor;
  const slug = hoodList.find((h) => h.name === hood)?.slug;
  const place = slug ? PLACES[slug] : undefined;
  const borough = areaOfPlace(hood)?.borough;
  // Both share their cards' caches (Gatherings, Introductions); members only, like those cards.
  const events = useQuery({ ...eventsQuery, enabled: approved && !!hood }).data ?? [];
  const intros = useQuery({ ...introsQuery(userId, hood), enabled: approved && !!hood }).data;
  const gathersAt = events.find((e) => e.neighborhood === hood)?.location;
  // Introductions return at most four, so four means "four or more".
  const near = intros?.filter((m) => m.neighborhood === hood).length;
  const neighbors = near === undefined ? null : near === 0 ? "Just you, for now" : near >= 4 ? "4+ neighbors" : `${near} neighbor${near === 1 ? "" : "s"}`;
  const edit = <EditButton card="neighborhood" editing={false} onClick={() => editor.add("directory", "neighborhood")} />;
  const work = [card.business, card.specialty].filter((s) => s.trim()).join(" · ");

  if (!hood) {
    return (
      <Letter id="where" no={2} title="Where you belong" subtitle="Your pin on the collective’s map of neighbors" action={edit}>
        <EmptySlot icon="map-pin">
          <p className="air-empty-title">No neighborhood yet</p>
          <p>{card.status === "declined" ? "Choose yours and your pin goes on the map." : "Choose yours and your pin goes on the map, next to the neighbors you’ll meet first."}</p>
          <button type="button" onClick={() => editor.add("directory", "neighborhood")} className={cn("air-link", ring)}>Choose your neighborhood</button>
        </EmptySlot>
      </Letter>
    );
  }

  return (
    <Letter id="where" no={2} title="Where you belong" subtitle="Your pin on the collective’s map of neighbors" action={edit}>
      <div className={cn("air-where", !place && "air-where--nomap")}>
        {place && (
          <NeighborhoodMap center={place.center} label={hood}>
            <div className="air-map-pin">
              <div className="air-map-pop">
                {approved && card.catalogue_number !== null && <span className="air-lbl">Member No. {formatCatalogueNumber(card.catalogue_number)}</span>}
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
          <p className="air-post-city">{borough ? `${borough}, ` : ""}New York{place ? ` ${place.zip}` : ""}</p>
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
    </Letter>
  );
}
