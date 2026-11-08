import { useMutation } from "@tanstack/react-query";
import type { ApplicationInput } from "./schema";
import { submitApplicationFn } from "./fns";

/** Saves the application; the server links it to the signed-in applicant when there is one (§2.6). */
export const submitApplication = (input: ApplicationInput): Promise<void> => submitApplicationFn({ data: input });

export const submitApplicationMutation = () => ({ mutationFn: submitApplication });

export const useSubmitApplication = () => useMutation(submitApplicationMutation());
