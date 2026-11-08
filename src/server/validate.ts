// Input checks at the server-function boundary: shapes only (the database CHECKs own lengths and formats).
import { AccessError } from "./guard";

export const bad = (what: string) => new AccessError(`Invalid ${what}.`, 400);
export const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
export function str(v: unknown, what: string, max = 4096): string {
  if (typeof v !== "string" || v.length > max) throw bad(what);
  return v;
}
export function oneOf<T extends string>(v: unknown, values: readonly T[], what: string): T {
  if (!values.includes(v as T)) throw bad(what);
  return v as T;
}
export function bytesOf(v: unknown): Uint8Array {
  if (v instanceof Uint8Array) return v;
  if (v instanceof ArrayBuffer) return new Uint8Array(v);
  throw bad("file");
}

/** JSON as stored in a text column (e.g. applications.answers). */
export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
