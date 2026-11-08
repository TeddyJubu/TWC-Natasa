// Lazy so Better Auth's client stays out of the entry chunk (public routes never need it). Same origin: /api/auth.
let client: Promise<ReturnType<typeof import("better-auth/client").createAuthClient>> | undefined;
export const getAuthClient = () => (client ??= import("better-auth/client").then((m) => m.createAuthClient()));
