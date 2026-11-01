// Small helpers the routes for a person's own archetypes, concepts and links share. Server code only.

import { getSession } from "@/lib/session";
import { LIMITS } from "@/lib/own-archetypes-core";
import type { Failure } from "@/lib/own-archetypes";

/** The signed-in person's id, or a 401 response to return. */
export async function requireUser(): Promise<{ userId: number } | { response: Response }> {
  const session = await getSession();
  if (!session.userId) return { response: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  return { userId: session.userId };
}

/** An id from the address: a positive whole number, or null. */
export function idParam(raw: string): number | null {
  const n = Number(raw);
  return /^\d{1,9}$/.test(raw) && n > 0 ? n : null;
}

/** The response for something that could not be done. `kind` says which limit applies when the limit was hit. */
export function problem(error: Failure, kind: keyof typeof LIMITS): Response {
  if (error === "limit") return Response.json({ error: `You have reached the limit of ${LIMITS[kind]} ${kind}. Delete one to make room.` }, { status: 409 });
  if (error === "duplicate") return Response.json({ error: kind === "links" ? "That link is already there" : "You already have one with that name" }, { status: 409 });
  return Response.json({ error: "Not found" }, { status: 404 });
}

/** A body that is not JSON becomes null, so the cleaning functions can say what is wrong. */
export async function bodyOf(request: Request): Promise<unknown> {
  return request.json().catch(() => null);
}

export { jsonBody } from "./json-body";
