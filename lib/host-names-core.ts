// The names a leader's copy answers to besides this computer (open item H2.2, docs/plan-host-mode.md point 4): the private address that Tailscale
// Serve or a Headscale proxy gives it. They are kept in a small file beside the data folder, written only from the /host page, so the leader can add
// the address without editing settings and restarting. Pure: no file, no database, so the browser and the tests can use it.
//
// The check stays a list of whole names. A name is never accepted by a pattern such as "anything ending in .ts.net", and a name that means this
// computer, a wildcard or an ordinary internet address shape that is not a full name is refused, so the file cannot weaken the DNS-rebinding guard.

/** The most names the file may hold: a Tailscale name, a Headscale name and a spare. */
export const MAX_HOST_NAMES = 5;

export interface HostNamesFile {
  /** Whole host names, lower case, without scheme, port or path. */
  names: string[];
  /** When the leader confirmed, on the /host page, that they understand they can read what their friends write. Null until then. */
  acknowledgedAt: string | null;
}

export const EMPTY_HOST_NAMES: HostNamesFile = { names: [], acknowledgedAt: null };

/** The file beside the data folder, named after it like the secrets file and the backups folder. */
export function hostNamesFileFor(dataDir: string): string {
  return `${dataDir.replace(/[\\/]+$/, "")}.allowed-hosts.json`;
}

const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]", "0.0.0.0"]);

/**
 * What the leader typed or pasted ("https://my-pc.tail1234.ts.net", "my-pc.tail1234.ts.net:443/") as a whole host name, or an error in plain
 * words. Accepts a full name of at least two labels, or a Tailscale address (100.64.0.0 to 100.127.255.255). Refuses this computer's own names,
 * wildcards, other IP addresses and anything with a user name or odd characters.
 */
export function cleanHostEntry(raw: unknown): { ok: true; name: string } | { ok: false; error: string } {
  if (typeof raw !== "string" || !raw.trim()) return { ok: false, error: "Paste the address your friends will open." };
  let t = raw.trim().toLowerCase();
  if (t.length > 300) return { ok: false, error: "That address is too long." };
  t = t.replace(/^https?:\/\//, "");
  if (t.includes("@")) return { ok: false, error: "Leave out any user name: paste only the address." };
  t = t.replace(/[/?#].*$/, "").replace(/:\d{1,5}$/, "").replace(/\.$/, "");
  if (LOOPBACK.has(t)) return { ok: false, error: "That name means this computer, which the app always answers to. Paste the private address your friends will use." };
  if (t.includes("*")) return { ok: false, error: "A wildcard is not allowed. Paste one whole address." };
  const ip = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(t);
  if (ip) {
    const [a, b, c, d] = ip.slice(1).map(Number);
    const tailscale = a === 100 && b >= 64 && b <= 127 && c <= 255 && d <= 255;
    return tailscale ? { ok: true, name: t } : { ok: false, error: "Only a Tailscale address (100.64 to 100.127) or a full name is allowed." };
  }
  const labels = t.split(".");
  if (labels.length < 2 || !labels.every((l) => LABEL.test(l)) || t.length > 253) {
    return { ok: false, error: "That does not look like a full address, such as my-pc.tail1234.ts.net." };
  }
  if (/^\d+$/.test(labels[labels.length - 1])) return { ok: false, error: "That does not look like a full address, such as my-pc.tail1234.ts.net." };
  return { ok: true, name: t };
}

/** The file's contents, checked again on every read; anything malformed counts as empty, so a damaged file never lets a name in. */
export function parseHostNames(text: string | null | undefined): HostNamesFile {
  if (!text) return EMPTY_HOST_NAMES;
  try {
    const raw = JSON.parse(text) as { names?: unknown; acknowledgedAt?: unknown };
    const names: string[] = [];
    for (const n of Array.isArray(raw.names) ? raw.names : []) {
      const c = cleanHostEntry(n);
      if (c.ok && !names.includes(c.name) && names.length < MAX_HOST_NAMES) names.push(c.name);
    }
    const at = typeof raw.acknowledgedAt === "string" && !Number.isNaN(Date.parse(raw.acknowledgedAt)) ? raw.acknowledgedAt : null;
    return { names, acknowledgedAt: at };
  } catch {
    return EMPTY_HOST_NAMES;
  }
}

/** The /host page's change to the file: add or remove one name, or record the acknowledgement. Returns the new contents or an error. */
export function changeHostNames(
  current: HostNamesFile,
  change: unknown,
  now = new Date(),
): { ok: true; file: HostNamesFile } | { ok: false; error: string } {
  const c = (change ?? {}) as { add?: unknown; remove?: unknown; acknowledge?: unknown };
  if (c.acknowledge === true) return { ok: true, file: { ...current, acknowledgedAt: current.acknowledgedAt ?? now.toISOString() } };
  if (typeof c.remove === "string") return { ok: true, file: { ...current, names: current.names.filter((n) => n !== c.remove) } };
  if (c.add !== undefined) {
    if (!current.acknowledgedAt) return { ok: false, error: "First confirm, in step 1, that you understand what hosting means for your friends' privacy." };
    const cleaned = cleanHostEntry(c.add);
    if (!cleaned.ok) return cleaned;
    if (current.names.includes(cleaned.name)) return { ok: true, file: current };
    if (current.names.length >= MAX_HOST_NAMES) return { ok: false, error: `At most ${MAX_HOST_NAMES} addresses. Remove one first.` };
    return { ok: true, file: { ...current, names: [...current.names, cleaned.name] } };
  }
  return { ok: false, error: "Nothing to change." };
}
