// Application server functions (see src/features/members/fns.ts for the pattern).
import { createServerFn } from "@tanstack/react-start";

export const applicantFn = createServerFn().handler(async () => {
  const [{ serve }, m] = await Promise.all([import("@/server/context.server"), import("./applications.server")]);
  return serve(m.applicant);
});
