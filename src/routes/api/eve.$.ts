import { createFileRoute } from "@tanstack/react-router";

// The admin's chat with Eve: the session cookie is checked before anything reaches the Eve service.
const handle = async ({ request, params }: { request: Request; params: { _splat?: string } }) => {
  const [{ getDb }, { actorFrom }, { proxyEve }] = await Promise.all([
    import("@/server/db"), import("@/server/context.server"), import("@/features/eve/eve.server"),
  ]);
  return proxyEve({ db: getDb(), actor: await actorFrom(request.headers) }, request, params._splat ?? "");
};

export const Route = createFileRoute("/api/eve/$")({
  server: { handlers: { GET: handle, POST: handle } },
});
