/** CRM-010: JSON 404 for unknown `/api/*` (never the HTML app page). */
export const apiNotFound = () =>
  Response.json({ error: "Not found" }, { status: 404, headers: { "Cache-Control": "no-store" } });
