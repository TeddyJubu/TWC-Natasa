// Server functions for the built-in forms' wording. publicFormCopyFn needs no session; the admin read and the save
// start with requireAdmin (in copy.server.ts).
import { createServerFn } from "@tanstack/react-start";
import type { CopyForm } from "./manifest";

const pass = <T,>(input: unknown) => input as T;

const load = () => Promise.all([import("@/server/context.server"), import("./copy.server")]);

export const publicFormCopyFn = createServerFn()
  .validator(pass<{ form: CopyForm }>)
  .handler(async ({ data }) => {
    const [{ serve }, m] = await load();
    return serve((c) => m.publicFormCopy(c, data));
  });

export const adminFormCopyFn = createServerFn()
  .validator(pass<{ form: CopyForm }>)
  .handler(async ({ data }) => {
    const [{ serve }, m] = await load();
    return serve((c) => m.adminFormCopy(c, data));
  });

export type SaveFormCopyInput = { form: CopyForm; values: Record<string, string> };

export const saveFormCopyFn = createServerFn({ method: "POST" })
  .validator(pass<SaveFormCopyInput>)
  .handler(async ({ data }) => {
    const [{ serve }, m] = await load();
    return serve((c) => m.saveFormCopy(c, data));
  });
