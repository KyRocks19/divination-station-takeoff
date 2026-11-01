import { query } from "./db";
import type { Comfort } from "./comfort";

/**
 * Keeps the person's reading-comfort choices in their account (migration 079, open item T15a), or removes them (null), which puts the choices
 * back on the device alone.
 */
export async function saveComfort(userId: number, comfort: Comfort | null): Promise<void> {
  await query("UPDATE users SET comfort = $1 WHERE id = $2", [comfort ? JSON.stringify(comfort) : null, userId]);
}
