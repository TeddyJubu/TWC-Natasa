import { createFileRoute } from "@tanstack/react-router";
import { terms, legalHead } from "@/features/legal/content";
import { LegalPage } from "@/features/legal/LegalPage";

export const Route = createFileRoute("/terms")({
  head: () => legalHead(terms),
  component: () => <LegalPage doc={terms} />,
});
