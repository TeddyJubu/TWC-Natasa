import { createFileRoute } from "@tanstack/react-router";

// The changes Eve has prepared, waiting for this admin. Confirming one is the only way any of them runs.
export const Route = createFileRoute("/api/eve-proposals")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const [{ getDb }, { actorFrom }, { listProposals }, { respond }] = await Promise.all([
          import("@/server/db"), import("@/server/context.server"), import("@/features/eve/eve.server"), import("@/server/request"),
        ]);
        const c = { db: getDb(), actor: await actorFrom(request.headers) };
        return respond(() => ({ proposals: listProposals(c) }));
      },
      POST: async ({ request }: { request: Request }) => {
        const [{ getDb }, { actorFrom }, { decideProposal }, { checkSize, respond }] = await Promise.all([
          import("@/server/db"), import("@/server/context.server"), import("@/features/eve/eve.server"), import("@/server/request"),
        ]);
        const c = { db: getDb(), actor: await actorFrom(request.headers) };
        return respond(async () => {
          checkSize(request, 512);
          const body = await request.json().catch(() => null) as { id?: unknown; decision?: unknown } | null;
          return decideProposal(c, body?.id, body?.decision);
        });
      },
    },
  },
});
