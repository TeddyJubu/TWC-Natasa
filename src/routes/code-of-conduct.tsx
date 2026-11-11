import { createFileRoute } from "@tanstack/react-router";
import { codeOfConduct } from "@/features/legal/content";
import { legalHead, legalHeads } from "@/features/legal/heads";
import { LegalPage } from "@/features/legal/LegalPage";

export const Route = createFileRoute("/code-of-conduct")({
  head: () => legalHead(legalHeads.codeOfConduct),
  component: () => <LegalPage doc={codeOfConduct} />,
});
