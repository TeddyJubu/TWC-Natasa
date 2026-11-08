// Application server functions (see src/features/members/fns.ts for the pattern).
import { createServerFn } from "@tanstack/react-start";
import type { ApplicationInput } from "./schema";

export const submitApplicationFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => input as ApplicationInput)
  .handler(async ({ data }) => {
    const [{ serve }, m] = await Promise.all([import("@/server/context.server"), import("./applications.server")]);
    return serve((c) => m.submitApplication(c, data));
  });

export const applicantFn = createServerFn().handler(async () => {
  const [{ serve }, m] = await Promise.all([import("@/server/context.server"), import("./applications.server")]);
  return serve(m.applicant);
});
