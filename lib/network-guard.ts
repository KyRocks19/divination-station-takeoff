import dgram from "node:dgram";
import dns from "node:dns";
import net from "node:net";

// The Feathered edition's outgoing-connection guard (docs/plan-feathered-edition.md, section 5, layer 3). Feathered has no code that connects anywhere, and
// its build is checked for outside addresses; this is the last layer: if anything in the server ever tried, the connection is refused here and logged.
// Installed once at start by instrumentation.ts, in the Feathered build only. Only this computer may be reached: loopback addresses, "localhost", and
// local (Unix socket or Windows pipe) connections. Server code only.

/** True for a name or address on this computer only. */
export function isLoopback(host: string | undefined | null): boolean {
  if (!host) return true; // Node's default host is this computer.
  const h = host.trim().toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost")) return true;
  if (h === "::1" || h === "0:0:0:0:0:0:0:1") return true;
  if (/^::ffff:127\./.test(h)) return true;
  return /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h);
}

export class OutsideConnectionRefused extends Error {
  constructor(what: string) {
    super(`The Feathered edition connects to nothing outside this computer, so this was refused: ${what}`);
    this.name = "OutsideConnectionRefused";
  }
}

/** The host a net.Socket#connect call aims at, or null for a local socket path (allowed). Covers (options), (port, host) and (path). */
export function connectTarget(args: unknown[]): { host: string | undefined } | null {
  const first = args[0];
  if (Array.isArray(first)) return connectTarget(first); // Node passes normalized [options, cb] internally.
  if (first && typeof first === "object") {
    const o = first as { path?: unknown; host?: unknown };
    if (typeof o.path === "string") return null;
    return { host: typeof o.host === "string" ? o.host : undefined };
  }
  if (typeof first === "string" && !/^\d+$/.test(first)) return null; // a socket path
  return { host: typeof args[1] === "string" ? args[1] : undefined };
}

let installed = false;

/** Replaces the server's ways out with ones that refuse anything but this computer. Safe to call more than once. */
export function installNetworkGuard(log: (line: string) => void = (l) => console.error(l)): void {
  if (installed) return;
  installed = true;
  const refuse = (what: string) => {
    const err = new OutsideConnectionRefused(what);
    log(`[network-guard] ${err.message}`);
    return err;
  };

  const connect = net.Socket.prototype.connect;
  net.Socket.prototype.connect = function (this: net.Socket, ...args: unknown[]) {
    const target = connectTarget(args);
    if (target && !isLoopback(target.host)) throw refuse(`a connection to ${target.host}`);
    return (connect as (...a: unknown[]) => net.Socket).apply(this, args);
  } as typeof connect;

  const lookup = dns.lookup;
  dns.lookup = function (hostname: string, ...rest: unknown[]) {
    if (!isLoopback(hostname)) throw refuse(`looking up ${hostname}`);
    return (lookup as (...a: unknown[]) => unknown)(hostname, ...rest);
  } as typeof dns.lookup;
  const lookupP = dns.promises.lookup;
  dns.promises.lookup = function (hostname: string, ...rest: unknown[]) {
    if (!isLoopback(hostname)) return Promise.reject(refuse(`looking up ${hostname}`));
    return (lookupP as (...a: unknown[]) => Promise<unknown>)(hostname, ...rest);
  } as typeof dns.promises.lookup;
  for (const name of ["resolve", "resolve4", "resolve6", "resolveAny", "resolveTxt", "resolveMx", "resolveSrv", "resolveCname", "resolveNs", "reverse"] as const) {
    (dns as unknown as Record<string, unknown>)[name] = () => {
      throw refuse(`a name lookup (${name})`);
    };
    (dns.promises as unknown as Record<string, unknown>)[name] = () => Promise.reject(refuse(`a name lookup (${name})`));
  }

  const send = dgram.Socket.prototype.send;
  dgram.Socket.prototype.send = function (this: dgram.Socket, ...args: unknown[]) {
    const host = args.find((a, i) => i > 0 && typeof a === "string") as string | undefined;
    if (!isLoopback(host)) throw refuse(`a message to ${host}`);
    return (send as (...a: unknown[]) => void).apply(this, args);
  } as typeof send;

  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, "http://localhost");
    if (!isLoopback(url.hostname)) throw refuse(`a request to ${url.origin}`);
    return realFetch(input, init);
  }) as typeof fetch;
}
