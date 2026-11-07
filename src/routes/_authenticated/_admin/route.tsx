import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getSupabase } from "@/app/supabase";

/** Asks the self-only is_admin(); anything but exactly `true` (including an error) counts as no. */
async function isAdmin(): Promise<boolean> {
  try {
    const { data, error } = await (await getSupabase()).rpc("is_admin");
    return !error && data === true;
  } catch {
    return false;
  }
}

// UX only: every admin read and write is enforced by is_admin() policies in the database.
export const Route = createFileRoute("/_authenticated/_admin")({
  beforeLoad: async () => {
    if (!(await isAdmin())) throw redirect({ to: "/account" });
  },
  component: () => <Outlet />,
});
