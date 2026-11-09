// Custom form server functions (see src/features/members/fns.ts for the pattern). openFormFn needs no session (forms
// are public); adminFormResponsesFn starts with requireAdmin. Answers are sent to POST /api/forms/<slug>.
import { createServerFn } from "@tanstack/react-start";

const pass = <T,>(input: unknown) => input as T;

export const openFormFn = createServerFn()
  .validator(pass<{ slug: string }>)
  .handler(async ({ data }) => {
    const [{ serve }, m] = await Promise.all([import("@/server/context.server"), import("./forms.server")]);
    return serve((c) => m.openForm(c, data));
  });

export const adminFormResponsesFn = createServerFn().handler(async () => {
  const [{ serve }, m] = await Promise.all([import("@/server/context.server"), import("./forms.server")]);
  return serve(m.adminFormResponses);
});
