import { SessionOptions } from "iron-session";
import { SESSION_DAYS } from "./account-state";
import type { PendingChallenge } from "./passkeys-core";

// Kept apart from lib/session.ts so that proxy.ts can read the cookie without loading the database code.

export interface SessionData {
  userId?: number;
  username?: string;
  isAdmin?: boolean;
  /** The account's session_version when this session was made (missing on sessions made before migration 039: counts as 0). */
  sv?: number;
  /** A passkey request waiting for the device's answer (lib/passkeys-core.ts); used once, then removed. */
  pk?: PendingChallenge;
  /**
   * Set by the quick exit (lib/quick-exit-core.ts): this browser is locked and shows the snake game. `u` is the account whose password unlocks it, `back`
   * the page to return to. While it is set there is no userId, so nothing of the person's can be read.
   */
  decoy?: { u: string; back: string };
}

export const SESSION_OPTIONS: SessionOptions = {
  password: process.env.SESSION_SECRET || (() => { throw new Error("SESSION_SECRET env var is required"); })(),
  cookieName: "tarot_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  },
};
