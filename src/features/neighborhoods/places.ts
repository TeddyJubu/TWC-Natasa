// Where each of the original seven neighborhoods is: the map centre (a central subway stop, never anyone's
// address), its main ZIP and that stop. Keyed by slug, so a renamed neighborhood keeps its place; one an admin adds
// later has no entry, and the "Where you belong" card then shows no map or stop rather than a guessed one.
// ponytail: code, not columns; move to the neighborhoods table when admins need to place new ones.

export type Place = { center: [lng: number, lat: number]; zip: string; stop: string; lines: string[] };

export const PLACES: Record<string, Place> = {
  "long-island-city": { center: [-73.9456, 40.7471], zip: "11101", stop: "Court Sq", lines: ["7", "E", "G", "M"] },
  astoria: { center: [-73.9258, 40.7616], zip: "11106", stop: "Broadway", lines: ["N", "W"] },
  sunnyside: { center: [-73.9186, 40.7432], zip: "11104", stop: "46 St–Bliss St", lines: ["7"] },
  "jackson-heights": { center: [-73.8912, 40.7466], zip: "11372", stop: "Jackson Hts–Roosevelt Av", lines: ["7", "E", "F", "M", "R"] },
  elmhurst: { center: [-73.882, 40.7424], zip: "11373", stop: "Elmhurst Av", lines: ["M", "R"] },
  "forest-hills": { center: [-73.8448, 40.7214], zip: "11375", stop: "Forest Hills–71 Av", lines: ["E", "F", "M", "R"] },
  "rego-park": { center: [-73.8616, 40.7263], zip: "11374", stop: "63 Dr–Rego Park", lines: ["M", "R"] },
};

/** "40.7432° N · 73.9186° W" */
export const formatCoords = ([lng, lat]: [number, number]) =>
  `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? "N" : "S"} · ${Math.abs(lng).toFixed(4)}° ${lng >= 0 ? "E" : "W"}`;
