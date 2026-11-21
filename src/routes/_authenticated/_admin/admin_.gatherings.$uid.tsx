import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/_admin/admin_/gatherings/$uid")({ component: () => null });
