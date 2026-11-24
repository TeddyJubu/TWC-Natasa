import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * The member directory is members-only (owner decision, 2026-11-24): the old public catalogue at /members now sends
 * everyone to /directory, which asks visitors to sign in and shows members their directory. No member data is loaded
 * here, so none reaches the server's HTML.
 */
export const Route = createFileRoute("/members")({
  beforeLoad: () => {
    throw redirect({ to: "/directory" });
  },
});
