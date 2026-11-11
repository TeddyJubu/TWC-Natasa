// The doop design-sync script captures the live /f/<slug> page for the design canvas. It is a third party on a page
// that collects names and emails, so it loads only in a build made with VITE_DOOP_SYNC=true (never production), and
// only then does contentSecurityPolicy() allow its origin. Read per call so tests can stub it.
export const DOOP_ORIGIN = "https://doop.design";
// Public capture key for the doop canvas.
export const DOOP_SYNC_SRC = `${DOOP_ORIGIN}/doop-sync.js?key=dk_43wWjXdIlAXKScXwf9wqhCzb`;

export const doopSyncOn = () => import.meta.env.VITE_DOOP_SYNC === "true";
