// Custom form server functions (see src/features/members/fns.ts for the pattern). openFormFn needs no session (forms
// are public); admin reads/writes start with requireAdmin. Answers are sent to POST /api/forms/<slug>.
import { createServerFn } from "@tanstack/react-start";
import type { Question } from "./schema";

const pass = <T,>(input: unknown) => input as T;

export type SaveAdminFormInput = {
  id?: string;
  name: string;
  slug: string;
  intro?: string;
  thanks?: string;
  closed_message?: string;
  open?: boolean;
  one_per_email?: boolean;
  questions: Question[];
};

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

/** Open or close a form (and optionally set closed_message). Admins only. */
export const setFormOpenFn = createServerFn({ method: "POST" })
  .validator(pass<{ id: string; open: boolean; message?: string }>)
  .handler(async ({ data }) => {
    const [{ serve }, m] = await Promise.all([import("@/server/context.server"), import("./forms.server")]);
    return serve((c) => m.setFormOpen(c, data));
  });

/** Create or update a form definition (saveForm + checkQuestions). Admins only. */
export const saveAdminFormFn = createServerFn({ method: "POST" })
  .validator(pass<SaveAdminFormInput>)
  .handler(async ({ data }) => {
    const [{ serve }, m] = await Promise.all([import("@/server/context.server"), import("./forms.server")]);
    return serve((c) => m.saveAdminForm(c, data));
  });

/** CSV of every answer for one form; POST so it never sits in a GET cache. Admins only. */
export const formResponsesCsvFn = createServerFn({ method: "POST" })
  .validator(pass<{ id: string }>)
  .handler(async ({ data }) => {
    const [{ serve }, m] = await Promise.all([import("@/server/context.server"), import("./forms.server")]);
    return serve((c) => m.formResponsesCsv(c, data));
  });

/** Delete a form and all its answers. Admins only. */
export const deleteAdminFormFn = createServerFn({ method: "POST" })
  .validator(pass<{ id: string }>)
  .handler(async ({ data }) => {
    const [{ serve }, m] = await Promise.all([import("@/server/context.server"), import("./forms.server")]);
    return serve((c) => m.deleteAdminForm(c, data));
  });
