import { createFileRoute } from "@tanstack/react-router";
import { codeOfConduct, legalHead } from "@/features/legal/content";
import { LegalPage } from "@/features/legal/LegalPage";

export const Route = createFileRoute("/code-of-conduct")({
  head: () => legalHead(codeOfConduct),
  component: () => <LegalPage doc={codeOfConduct} />,
});
