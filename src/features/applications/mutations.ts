import { useMutation } from "@tanstack/react-query";
import { getSupabase } from "@/app/supabase";
import type { Json } from "@/integrations/supabase/types";
import type { ApplicationInput } from "./schema";

/**
 * Inserts the application, linked to the signed-in applicant when there is one (§2.6).
 * No `.select()`: anonymous applicants can insert but have no read access to the row.
 */
export async function submitApplication(input: ApplicationInput): Promise<void> {
  const supabase = await getSupabase();
  const { data, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const { error } = await supabase.from("applications").insert({
    email: input.email,
    full_name: input.fullName,
    neighborhood: input.neighborhood,
    answers: input.answers as unknown as Json,
    user_id: data.session?.user.id ?? null,
  });
  if (error) throw error;
}

export const submitApplicationMutation = () => ({ mutationFn: submitApplication });

export const useSubmitApplication = () => useMutation(submitApplicationMutation());
