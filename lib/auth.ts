import bcrypt from "bcryptjs";
import { artKeysOfUser, deleteArt } from "./art-store";
import { addStarterLayouts } from "./starter-layouts";
import { handOverBeforeDelete } from "./circles";
import { releaseLettersBeforeDelete } from "./letters";
import crypto from "crypto";
import { query, queryOne } from "./db";
import { forgetAccountState } from "./session";
import { passwordChanged } from "./seal";

export interface User {
  id: number;
  username: string;
  display_name: string | null;
  password_hash: string;
  is_admin: number;
  /** 1 when an admin has allowed the shared Claude tool key to act for this account. */
  claude_access: number;
  /** 1 when an admin has switched the account off: it cannot sign in and open sessions stop working. */
  disabled: number;
  /** Goes up when the password changes; a session made before that stops working. */
  session_version: number;
  created_at: string;
}

/** The account with this username, ignoring capitals ("Kylie" and "kylie" are the same name, as when joining). The exact spelling wins if two ever differ only by capitals. */
export async function getUserByUsername(username: string): Promise<User | null> {
  return queryOne<User>("SELECT * FROM users WHERE LOWER(username) = LOWER($1) ORDER BY (username = $1) DESC, id ASC LIMIT 1", [username]);
}

export async function getUserById(id: number): Promise<User | null> {
  return queryOne<User>("SELECT * FROM users WHERE id = $1", [id]);
}

export type ListedUser = Omit<User, "password_hash" | "session_version"> & {
  /** An admin's own daily limit for Claude help; null means the default. */
  ai_daily_limit: number | null;
  /** An admin's own daily limit for pictures; null means the default. */
  image_daily_limit: number | null;
  /** 1 when an admin has let this person make a circle (admins always can). */
  can_make_circles: number;
};

export async function listUsers(): Promise<ListedUser[]> {
  return query<ListedUser>(
    "SELECT id, username, display_name, is_admin, claude_access, disabled, ai_daily_limit, image_daily_limit, can_make_circles, created_at FROM users ORDER BY created_at ASC"
  );
}

/** Sets one person's daily number of pictures: a whole number (0 switches picture-making off for them), or null for the default. */
export async function setImageDailyLimit(userId: number, limit: number | null): Promise<void> {
  await query("UPDATE users SET image_daily_limit = $1 WHERE id = $2", [limit, userId]);
}

/** Sets one person's daily limit for Claude help: a whole number (0 switches it off for them), or null for the default. */
export async function setAiDailyLimit(userId: number, limit: number | null): Promise<void> {
  await query("UPDATE users SET ai_daily_limit = $1 WHERE id = $2", [limit, userId]);
}

export async function setClaudeAccess(userId: number, allowed: boolean): Promise<void> {
  await query("UPDATE users SET claude_access = $1 WHERE id = $2", [allowed ? 1 : 0, userId]);
}

// A hash nobody's password matches, compared against when the username does not exist, so a missing account takes as long
// to refuse as a wrong password and the time does not tell which usernames exist. The checks are asynchronous so a burst of
// sign-ins does not stall every other request on the server while the hashes are worked out.
const NO_ONE_HASH = bcrypt.hashSync("no-one-has-this-password", 12);

export async function verifyUserPassword(username: string, password: string): Promise<User | null> {
  const user = await getUserByUsername(username);
  if (!user) {
    await bcrypt.compare(password, NO_ONE_HASH);
    return null;
  }
  if (!(await bcrypt.compare(password, user.password_hash))) return null;
  // A switched-off account answers like a wrong password, so the sign-in page does not say which accounts exist.
  return user.disabled === 1 ? null : user;
}

export async function createUser(
  username: string,
  displayName: string | null,
  password: string,
  isAdmin = false
): Promise<User> {
  const hash = await bcrypt.hash(password, 12);
  const user = await queryOne<User>(
    "INSERT INTO users (username, display_name, password_hash, is_admin) VALUES ($1, $2, $3, $4) RETURNING *",
    [username, displayName ?? null, hash, isAdmin ? 1 : 0]
  );
  await addStarterLayouts(user!.id);
  return user!;
}

/** Sets a new password and ends every session that was signed in before it. Returns the account's new session_version. */
export async function changeUserPassword(userId: number, newPassword: string): Promise<number | null> {
  const hash = await bcrypt.hash(newPassword, 12);
  const row = await queryOne<{ session_version: number }>(
    "UPDATE users SET password_hash = $1, session_version = session_version + 1 WHERE id = $2 RETURNING session_version",
    [hash, userId]
  );
  forgetAccountState(userId);
  // On a locked copy the password is also the passphrase that opens the data: the new one replaces it (lib/seal.ts).
  if (row) passwordChanged(userId, newPassword);
  return row?.session_version ?? null;
}

/** Ends every session of this account, on every device, by raising its session_version. Returns the new version so the caller can renew its own session. */
export async function signOutEverywhere(userId: number): Promise<number | null> {
  const row = await queryOne<{ session_version: number }>(
    "UPDATE users SET session_version = session_version + 1 WHERE id = $1 RETURNING session_version",
    [userId]
  );
  forgetAccountState(userId);
  return row?.session_version ?? null;
}

/** Switches an account off (or back on). A switched-off account's open sessions stop working within seconds. */
export async function setDisabled(userId: number, disabled: boolean): Promise<void> {
  await query("UPDATE users SET disabled = $1 WHERE id = $2", [disabled ? 1 : 0, userId]);
  forgetAccountState(userId);
}

export async function deleteUser(userId: number): Promise<void> {
  // The rows go by the database's cascade; the picture files kept on disk are removed by their keys.
  const files = await artKeysOfUser(userId);
  // A circle this account owns passes to the member who joined first, so the others keep it (lib/circles.ts).
  await handOverBeforeDelete(userId);
  // A letter this account picked up and had not sealed goes back to waiting, so the asker keeps their question (lib/letters.ts).
  await releaseLettersBeforeDelete(userId);
  await query("DELETE FROM users WHERE id = $1", [userId]);
  await deleteArt(files, userId);
}

export function verifyClaudeKey(key: string): boolean {
  const envKey = process.env.CLAUDE_API_KEY;
  if (!envKey) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(key), Buffer.from(envKey));
  } catch {
    return false;
  }
}
