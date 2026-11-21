import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/gatherings_/$slug")({ component: () => null });
