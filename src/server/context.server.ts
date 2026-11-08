// Server-only: the database and the signed-in actor for the current request. Server-function handlers
// lazy-import this (with their feature's *.server.ts) and pass the result to the domain code.
import { getRequestHeaders } from "@tanstack/react-start/server";
import { getDb, type DB } from "./db";
import { getAuth } from "./auth.server";
import type { Actor } from "./guard";

export type Ctx = { db: DB; actor: Actor };

export async function actorFrom(headers: Headers): Promise<Actor> {
  const session = await getAuth().api.getSession({ headers });
  return session ? { id: session.user.id, email: session.user.email } : null;
}

export async function ctx(): Promise<Ctx> {
  return { db: getDb(), actor: await actorFrom(getRequestHeaders() as unknown as Headers) };
}
