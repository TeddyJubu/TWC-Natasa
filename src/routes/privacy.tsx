import { createFileRoute } from "@tanstack/react-router";
import { privacy, legalHead } from "@/features/legal/content";
import { LegalPage } from "@/features/legal/LegalPage";

export const Route = createFileRoute("/privacy")({
  head: () => legalHead(privacy),
  component: () => <LegalPage doc={privacy} />,
});
