import { createFileRoute } from "@tanstack/react-router";
import { terms } from "@/features/legal/content";
import { legalHead, legalHeads } from "@/features/legal/heads";
import { LegalPage } from "@/features/legal/LegalPage";

export const Route = createFileRoute("/terms")({
  head: () => legalHead(legalHeads.terms),
  component: () => <LegalPage doc={terms} />,
});
