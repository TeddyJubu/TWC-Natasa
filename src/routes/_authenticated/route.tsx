import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { sessionFn } from "@/features/auth/fns";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const user = await sessionFn().catch(() => null);
    if (!user) throw redirect({ to: "/auth" });
    return { user };
  },
  component: () => <Outlet />,
});
