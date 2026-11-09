// Custom forms on the client: the admin's answers list, open/close and CSV (requireAdmin on the server), and the
// public POST.
import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { postApi } from "@/app/api";
import { adminFormResponsesFn, formResponsesCsvFn, setFormOpenFn } from "./fns";
import type { Answers } from "./schema";

export type { AdminForm, AdminFormResponse, PublicForm } from "./forms.server";

/** Every form with its answer count and newest answers. */
export const adminFormResponsesQuery = queryOptions({ queryKey: ["admin", "form-responses"], queryFn: () => adminFormResponsesFn() });

export type FormOpenInput = { id: string; open: boolean; message?: string };

export function useSetFormOpen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: FormOpenInput) => setFormOpenFn({ data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "form-responses"] }),
  });
}

/** Fetches one form's CSV (requireAdmin on the server) and saves it through a temporary blob link. */
export async function downloadFormCsv(id: string): Promise<void> {
  const { filename, csv } = await formResponsesCsvFn({ data: { id } });
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export const useDownloadFormCsv = () => useMutation({ mutationFn: downloadFormCsv });

export type FormSubmission = { answers: Answers; honeypot: string };
export const sendFormAnswers = (slug: string, input: FormSubmission) => postApi<void>(`/api/forms/${slug}`, input);
