import { query, queryOne } from "./db";

/** Raise this when the privacy and terms text (components/PrivacyNotice.tsx) changes in a way people should read again. */
// 3 (2026-10-22): the kinds of writing added since 2026-10-19, and separate texts for a local copy and a host copy.
// 4 (2026-10-22, later): what you sense first and the companion tick, tarot practice, look-back reminders, the example and yearly review, and the
// "I am 18 or older" confirmation.
// 5 (2026-10-26): the owner's wording pass. One layered text, each idea said once; a Winged copy can be locked; the quick exit is the quick hide.
export const PRIVACY_VERSION = 5;

/** Whether the person has read the current privacy and terms text. */
export async function privacyAcknowledged(userId: number): Promise<boolean> {
  const row = await queryOne<{ privacy_ack_version: number }>("SELECT privacy_ack_version FROM users WHERE id = $1", [userId]);
  return !row || row.privacy_ack_version >= PRIVACY_VERSION;
}

export async function acknowledgePrivacy(userId: number): Promise<void> {
  await query("UPDATE users SET privacy_ack_version = $1, privacy_ack_at = NOW() WHERE id = $2", [PRIVACY_VERSION, userId]);
}

/** Only a path on this site is followed after the screen; anything else goes home. */
export function safeFrom(from: unknown): string {
  return typeof from === "string" && from.startsWith("/") && !from.startsWith("//") && !from.startsWith("/welcome") ? from : "/";
}
