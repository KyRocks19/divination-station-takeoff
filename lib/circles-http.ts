import { CIRCLE_PROBLEMS } from "./circles-core";
import type { Result } from "./circles";

// The answer a circle route sends back for a Result from lib/circles.ts.

/** A failed Result as a response with the plain-words error, or null when it succeeded. */
export function circleFailure(result: Result<unknown>): Response | null {
  if (result.ok) return null;
  const { status, error } = CIRCLE_PROBLEMS[result.problem];
  return Response.json({ error, code: result.problem }, { status });
}
