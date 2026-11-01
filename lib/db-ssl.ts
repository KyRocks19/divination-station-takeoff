// Neon needs a secure connection; a database on this computer (for a test) does not have one.
/** TLS settings for a database address: none for localhost or sslmode=disable, otherwise a checked connection. */
export function sslFor(url: string): false | { rejectUnauthorized: true } {
  try {
    const u = new URL(url);
    if (["localhost", "127.0.0.1", "::1", "[::1]"].includes(u.hostname) || u.searchParams.get("sslmode") === "disable") return false;
  } catch {
    /* fall through to secure */
  }
  return { rejectUnauthorized: true };
}

/**
 * The address to hand to `pg`. Newer versions of `pg` warn about `sslmode=require`, `prefer` and `verify-ca` (their meaning is
 * about to change to what libpq does, which is stricter), and the server log filled with that warning. This app already checks the
 * server's certificate (`sslFor` above), so those three are written as `verify-full`, which is what it does and which `pg` does
 * not warn about. `disable`, `verify-full`, `no-verify` and an address with no `sslmode` are left exactly as they are.
 */
export function connectionStringFor(url: string | undefined): string | undefined {
  if (!url) return url;
  try {
    const u = new URL(url);
    const mode = u.searchParams.get("sslmode");
    if (mode === "require" || mode === "prefer" || mode === "verify-ca") {
      u.searchParams.set("sslmode", "verify-full");
      return u.toString();
    }
  } catch {
    /* not an address we can read: pass it on untouched and let pg report it */
  }
  return url;
}
