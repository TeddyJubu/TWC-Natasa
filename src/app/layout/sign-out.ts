import * as React from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { getAuthClient } from "@/app/auth-client";
import { emitAuthEvent } from "@/app/auth-events";

/** Signs out, clears every cached query and goes to /auth; a failure stays on the page as `error`. */
export function useSignOut() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = React.useState<string | null>(null);

  async function signOut() {
    setError(null);
    try {
      const { error } = await (await getAuthClient()).signOut();
      if (error) throw new Error(error.message ?? "We couldn’t sign you out. Please try again.");
    } catch (e) {
      setError((e as { message?: string } | null)?.message || "Something went wrong. Please try again.");
      return;
    }
    await queryClient.cancelQueries();
    queryClient.clear();
    emitAuthEvent("SIGNED_OUT");
    navigate({ to: "/auth", replace: true });
  }

  return { signOut, error };
}
