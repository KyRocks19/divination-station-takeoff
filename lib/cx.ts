/** Joins class names, leaving out anything that is false, null, or undefined. */
export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}
