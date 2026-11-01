// The parts of recovery codes (open item S5) that need no database, so the Settings page in the browser can use them. No imports.

/** How many codes are in a set. */
export const RECOVERY_COUNT = 8;

export interface RecoveryStatus {
  remaining: number;
  /** When the current set was made; null when there is none. */
  madeAt: string | null;
}

/** The wording of what is left, for the Settings page. */
export function remainingWords(status: RecoveryStatus): string {
  if (!status.madeAt) return "You have not made recovery codes yet.";
  if (status.remaining === 0) return "You have used all your recovery codes. Make a new set.";
  return `${status.remaining} of ${RECOVERY_COUNT} recovery codes are unused.`;
}
