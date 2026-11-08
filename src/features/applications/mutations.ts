import { useMutation } from "@tanstack/react-query";
import type { ApplicationInput } from "./schema";
import { postApi } from "@/app/api";

/** Saves the application; the server links it to the signed-in applicant when there is one (§2.6). */
export const submitApplication = (input: ApplicationInput): Promise<void> => postApi<void>("/api/applications", input);

export const submitApplicationMutation = () => ({ mutationFn: submitApplication });

export const useSubmitApplication = () => useMutation(submitApplicationMutation());
