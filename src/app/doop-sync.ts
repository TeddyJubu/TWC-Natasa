// The doop design-sync script captures the live /f/<slug> page for the design canvas. It is a third party on a page
// that collects names and emails, so it loads only in a build made with VITE_DOOP_SYNC=true (never production), and
// only then does contentSecurityPolicy() allow its origin. Read per call so tests can stub it.
export const DOOP_ORIGIN = "https://doop.design";

export const doopSyncOn = () => import.meta.env.VITE_DOOP_SYNC === "true";

/**
 * The /f/<slug> head script. The flag is tested inline, not through doopSyncOn(), so Vite folds it in a build without
 * the flag and drops the URL (with its public capture key) from the bundles: `grep -r dk_ dist/` finds nothing.
 */
export const doopSyncScripts = () =>
  import.meta.env.VITE_DOOP_SYNC === "true"
    ? [{ async: true, src: "https://doop.design/doop-sync.js?key=dk_43wWjXdIlAXKScXwf9wqhCzb" }]
    : [];
