// Client side of the built-in forms' wording: the public read (loaders) and the admin editor's read and save.
import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminFormCopyFn, publicFormCopyFn, saveFormCopyFn, type SaveFormCopyInput } from "./fns";
import type { CopyForm } from "./manifest";

export type { FormCopy } from "./copy.server";

/** For a route loader: a failed read never breaks the page, it just shows the defaults. */
export const loadFormCopy = (form: CopyForm) => publicFormCopyFn({ data: { form } }).catch(() => ({}) as Record<string, string>);

export const adminFormCopyQuery = (form: CopyForm) => queryOptions({
  queryKey: ["admin", "form-copy", form],
  queryFn: () => adminFormCopyFn({ data: { form } }),
});

export function useSaveFormCopy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: SaveFormCopyInput) => saveFormCopyFn({ data }),
    onSuccess: (_void, data) => qc.invalidateQueries({ queryKey: ["admin", "form-copy", data.form] }),
  });
}
