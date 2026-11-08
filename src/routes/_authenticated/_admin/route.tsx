import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { viewerFn } from "@/features/auth/fns";

/** Asks the server about this session only; anything but exactly `true` (including an error) counts as no. */
async function isAdmin(): Promise<boolean> {
  try {
    return (await viewerFn()).admin === true;
  } catch {
    return false;
  }
}

// UX only: every admin read and write is checked again by requireAdmin in its server function.
export const Route = createFileRoute("/_authenticated/_admin")({
  beforeLoad: async () => {
    if (!(await isAdmin())) throw redirect({ to: "/account" });
  },
  component: () => <Outlet />,
});
