// The rules for a person deleting their own account (open item S3). Pure, so they can be tested; the route does the rest.

/** What the person types to confirm, besides their password. */
export const DELETE_PHRASE = "delete my account";

/** True when `typed` is the phrase, ignoring capitals and spaces at the ends. */
export function phraseMatches(typed: unknown): boolean {
  return typeof typed === "string" && typed.trim().toLowerCase() === DELETE_PHRASE;
}

/** Why this deletion must not go ahead, in words for the person, or null when it may. */
export function deletionProblem(input: { phrase: unknown; password: unknown; isAdmin: boolean; otherActiveAdmins: number }): string | null {
  if (typeof input.password !== "string" || !input.password) return "Type your password to delete your account.";
  if (!phraseMatches(input.phrase)) return `Type “${DELETE_PHRASE}” in the box to confirm.`;
  if (input.isAdmin && input.otherActiveAdmins < 1) {
    return "You are the only admin. Make someone else an admin first, so the app is not left without one.";
  }
  return null;
}
