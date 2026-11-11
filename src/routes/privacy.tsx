import { createFileRoute } from "@tanstack/react-router";
import { privacy } from "@/features/legal/content";
import { legalHead, legalHeads } from "@/features/legal/heads";
import { LegalPage } from "@/features/legal/LegalPage";

export const Route = createFileRoute("/privacy")({
  head: () => legalHead(legalHeads.privacy),
  component: () => <LegalPage doc={privacy} />,
});
