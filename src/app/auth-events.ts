import type { QueryClient } from "@tanstack/react-query";

/** Root auth listener: refresh routes and caches so audience-dependent pages (e.g. /members) follow the session. */
export function handleAuthEvent(event: string, queryClient: QueryClient, invalidateRouter: () => void) {
  if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
  invalidateRouter();
  if (event === "SIGNED_OUT") {
    // Covers sign-outs the account page didn't start (another tab, failed refresh): drop members-only data.
    queryClient.removeQueries({ queryKey: ["directory"] });
    void queryClient.resetQueries({ queryKey: ["viewer"] });
  } else {
    void queryClient.invalidateQueries();
  }
}
