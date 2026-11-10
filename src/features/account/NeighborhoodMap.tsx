// The "Where you belong" map: MapLibre on OpenFreeMap's Positron tiles, tinted onionskin blue. The map is a picture
// (no drag or scroll zoom, so it never traps the page's scroll); the buttons zoom, re-centre and go full screen.
// The pin, popup and neighborhood ring are HTML over the map's centre, so they show even when WebGL or the tiles don't.
import * as React from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import { cn } from "@/index";
import { ring } from "@/app/layout/app-classes";
import { Icon } from "@/app/layout/icons";

/** OpenFreeMap: free, no key, OpenStreetMap data. Its one origin is in the CSP's connect-src. */
const MAP_STYLE = "https://tiles.openfreemap.org/styles/positron";
const ZOOM = 14;
/** The dashed ring: roughly a neighborhood's walkable reach around its centre, in metres. */
const RING_M = 650;
const SCALES = [100, 200, 500, 1000, 2000, 5000];

/** Metres per CSS pixel at this latitude and zoom (MapLibre's 512px tiles). */
const metresPerPx = (lat: number, zoom: number) => (40075016.686 * Math.cos((lat * Math.PI) / 180)) / (512 * 2 ** zoom);
const reduced = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

export function NeighborhoodMap({ center, label, children }: {
  center: [number, number]; label: string; children: React.ReactNode;
}) {
  const box = React.useRef<HTMLDivElement>(null);
  const canvas = React.useRef<HTMLDivElement>(null);
  const map = React.useRef<MapLibreMap | null>(null);
  const [zoom, setZoom] = React.useState(ZOOM);
  const [ready, setReady] = React.useState(false);
  const [full, setFull] = React.useState(false);

  React.useEffect(() => {
    // jsdom and old browsers: no WebGL, so the card keeps its static pin.
    if (!canvas.current || !("WebGL2RenderingContext" in window)) return;
    let gone = false;
    void Promise.all([import("maplibre-gl"), import("maplibre-gl/dist/maplibre-gl.css")]).then(([maplibre]) => {
      if (gone || !canvas.current) return;
      maplibre.setWorkerUrl(workerUrl);
      const m = new maplibre.Map({
        container: canvas.current, style: MAP_STYLE, center, zoom: ZOOM, minZoom: 11, maxZoom: 17,
        interactive: false, attributionControl: false,
      });
      m.on("load", () => setReady(true));
      m.on("zoom", () => setZoom(m.getZoom()));
      map.current = m;
    }).catch(() => { /* the static pin stays */ });
    const onFull = () => { setFull(document.fullscreenElement === box.current); map.current?.resize(); };
    document.addEventListener("fullscreenchange", onFull);
    return () => {
      gone = true;
      document.removeEventListener("fullscreenchange", onFull);
      map.current?.remove();
      map.current = null;
    };
  }, [center]);

  const animate = () => !reduced();
  const mpp = metresPerPx(center[1], zoom);
  const scale = SCALES.find((m) => m / mpp >= 70) ?? SCALES[SCALES.length - 1];

  return (
    <div ref={box} className="air-map" role="group" aria-label={`Map of ${label}`}>
      {/* MapLibre's stylesheet makes its container position: relative, so the container fills a positioned wrapper. */}
      <div aria-hidden className="air-map-canvas"><div ref={canvas} className="size-full" /></div>
      <div aria-hidden className="air-map-tint" />
      <div aria-hidden className="air-map-ring" style={{ "--ring": `${(2 * RING_M) / mpp}px` } as React.CSSProperties} />
      {children}
      {ready && (
        <>
          <div className="air-map-ctrls">
            <div>
              <button type="button" aria-label="Zoom in" onClick={() => map.current?.zoomIn({ animate: animate() })} className={ring}><Icon name="plus" className="size-4" /></button>
              <button type="button" aria-label="Zoom out" onClick={() => map.current?.zoomOut({ animate: animate() })} className={ring}><Icon name="minus" className="size-4" /></button>
            </div>
            <div>
              <button type="button" aria-label={`Center on ${label}`} onClick={() => map.current?.easeTo({ center, zoom: ZOOM, animate: animate() })} className={ring}><Icon name="locate" className="size-4" /></button>
            </div>
            {document.fullscreenEnabled && (
              <div>
                <button
                  type="button" aria-label={full ? "Exit full screen" : "Full screen map"} aria-pressed={full} className={ring}
                  onClick={() => void (full ? document.exitFullscreen() : box.current?.requestFullscreen())}
                >
                  <Icon name={full ? "minimize" : "maximize"} className="size-4" />
                </button>
              </div>
            )}
          </div>
          <div aria-hidden className="air-map-scale" style={{ "--scale": `${scale / mpp}px` } as React.CSSProperties}>
            {scale >= 1000 ? `${scale / 1000} km` : `${scale} m`}<i />
          </div>
        </>
      )}
      <p className={cn("air-map-attr", !ready && "invisible")}>
        <a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a> · © <a href="https://www.openmaptiles.org/" target="_blank" rel="noreferrer">OpenMapTiles</a> · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>
      </p>
    </div>
  );
}
