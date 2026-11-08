// Member server functions. Each handler lazy-imports its server code (kept out of the client bundle) and runs
// it through serve(), which supplies this request's database and signed-in actor.
import { createServerFn } from "@tanstack/react-start";

const pass = <T,>(input: unknown) => input as T;

export const directoryFn = createServerFn().handler(async () => {
  const [{ serve }, m] = await Promise.all([import("@/server/context.server"), import("./members.server")]);
  return serve(m.directory);
});

export const publicProfilesFn = createServerFn().handler(async () => {
  const [{ serve }, m] = await Promise.all([import("@/server/context.server"), import("./members.server")]);
  return serve(m.publicProfiles);
});

export const ownProfileFn = createServerFn().handler(async () => {
  const [{ serve }, m] = await Promise.all([import("@/server/context.server"), import("./members.server")]);
  return serve(m.ownProfile);
});

export const introsFn = createServerFn()
  .validator((input: unknown) => ({ neighborhood: typeof input === "object" && input && typeof (input as { neighborhood?: unknown }).neighborhood === "string" ? (input as { neighborhood: string }).neighborhood : null }))
  .handler(async ({ data }) => {
    const [{ serve }, m] = await Promise.all([import("@/server/context.server"), import("./members.server")]);
    return serve((c) => m.intros(c, data.neighborhood));
  });

export const saveProfileFn = createServerFn({ method: "POST" })
  .validator(pass<Record<string, unknown>>)
  .handler(async ({ data }) => {
    const [{ serve }, m] = await Promise.all([import("@/server/context.server"), import("./members.server")]);
    return serve((c) => m.saveProfile(c, data));
  });

export const removeLogoFn = createServerFn({ method: "POST" }).handler(async () => {
  const [{ serve }, m] = await Promise.all([import("@/server/context.server"), import("./members.server")]);
  return serve(m.removeLogo);
});
