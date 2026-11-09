// Custom forms on the client: the admin's answers list (requireAdmin on the server) and the public POST.
import { queryOptions } from "@tanstack/react-query";
import { postApi } from "@/app/api";
import { adminFormResponsesFn } from "./fns";
import type { Answers } from "./schema";

export type { AdminForm, AdminFormResponse, PublicForm } from "./forms.server";

/** Every form with its answer count and newest answers. */
export const adminFormResponsesQuery = queryOptions({ queryKey: ["admin", "form-responses"], queryFn: () => adminFormResponsesFn() });

export type FormSubmission = { answers: Answers; honeypot: string };
export const sendFormAnswers = (slug: string, input: FormSubmission) => postApi<void>(`/api/forms/${slug}`, input);
