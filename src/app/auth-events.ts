import type { QueryClient } from "@tanstack/react-query";

export type AuthEvent = "SIGNED_IN" | "SIGNED_OUT" | "USER_UPDATED";

/** Root auth listener: refresh routes and caches so audience-dependent pages (e.g. /members) follow the session. */
export function handleAuthEvent(event: string, queryClient: QueryClient, invalidateRouter: () => void) {
  if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
  invalidateRouter();
  if (event === "SIGNED_OUT") {
    // Covers sign-outs the account page didn't start (another tab): drop members-only data.
    queryClient.removeQueries({ queryKey: ["directory"] });
    void queryClient.resetQueries({ queryKey: ["viewer"] });
  } else {
    void queryClient.invalidateQueries();
  }
}

// Sign-in and sign-out happen in our own pages; they announce it here, to this tab and (BroadcastChannel) the others.
const listeners = new Set<(event: AuthEvent) => void>();
let channel: BroadcastChannel | undefined;
const getChannel = () => {
  if (!channel && typeof BroadcastChannel !== "undefined") {
    channel = new BroadcastChannel("twc-auth");
    channel.onmessage = (message) => listeners.forEach((listener) => listener(message.data as AuthEvent));
  }
  return channel;
};

export function emitAuthEvent(event: AuthEvent) {
  listeners.forEach((listener) => listener(event));
  getChannel()?.postMessage(event);
}

/** Subscribes to auth events from this tab and the others; returns the unsubscribe. */
export function onAuthEvent(listener: (event: AuthEvent) => void): () => void {
  listeners.add(listener);
  getChannel();
  return () => void listeners.delete(listener);
}
