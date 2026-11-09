// Membership form open/close server functions. publicFormStateFn needs no session; admin reads/writes start with
// requireAdmin. Answers still go to POST /api/applications and POST /api/review (those check assertFormOpen).
import { createServerFn } from "@tanstack/react-start";
import type { FormKind } from "./constants";

const pass = <T,>(input: unknown) => input as T;

export const publicFormStateFn = createServerFn()
  .validator(pass<{ kind: FormKind }>)
  .handler(async ({ data }) => {
    const [{ serve }, m] = await Promise.all([import("@/server/context.server"), import("./forms-state.server")]);
    return serve((c) => m.publicFormState(c, data));
  });

export const adminFormsStateFn = createServerFn().handler(async () => {
  const [{ serve }, m] = await Promise.all([import("@/server/context.server"), import("./forms-state.server")]);
  return serve(m.adminFormsState);
});

export const setMembershipFormOpenFn = createServerFn({ method: "POST" })
  .validator(pass<{ kind: FormKind; open: boolean; message?: string }>)
  .handler(async ({ data }) => {
    const [{ serve }, m] = await Promise.all([import("@/server/context.server"), import("./forms-state.server")]);
    return serve((c) => m.setMembershipFormOpen(c, data));
  });
