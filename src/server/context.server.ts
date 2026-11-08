// Server-only: the database and the signed-in actor for the current request. Every server-function handler
// runs its domain code through serve(), lazy-importing this module and its feature's *.server.ts.
import { getRequestHeaders } from "@tanstack/react-start/server";
import { getDb, type DB } from "./db";
import { getAuth } from "./auth.server";
import type { Actor } from "./guard";
import { publicError } from "./request";

export type Ctx = { db: DB; actor: Actor };

export async function actorFrom(headers: Headers): Promise<Actor> {
  const session = await getAuth().api.getSession({ headers });
  return session ? { id: session.user.id, email: session.user.email } : null;
}

export async function ctx(): Promise<Ctx> {
  return { db: getDb(), actor: await actorFrom(getRequestHeaders() as unknown as Headers) };
}

/** Runs domain code with this request's context; errors reach the browser only as publicError() messages. */
export async function serve<T>(run: (c: Ctx) => T | Promise<T>): Promise<T> {
  const c = await ctx();
  try {
    return await run(c);
  } catch (error) {
    throw publicError(error);
  }
}
