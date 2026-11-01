// A guard against DNS rebinding. A web page on an attacker's domain can point its name at 127.0.0.1 and then talk to a server running on
// the visitor's own computer; the browser sends that name in the Host header, and lib/origin.ts alone would trust it (it accepts an Origin
// that matches the request's own Host). So a copy that runs on a person's computer lists the names it answers to and refuses the rest.
//
// The guard is on when DS_EDITION=local, or when ALLOWED_HOSTS is set. A hosted copy with neither (for example one behind a platform whose
// addresses change) is not restricted. Only the host name is compared, not the port.

import { editionOf } from "./edition";

/** Names a local copy always answers to. */
export const LOOPBACK_HOSTS = ["localhost", "127.0.0.1", "[::1]"];

/** The host name of a Host header value or a typed entry: lower case, without a port, scheme or path. "[::1]:3000" gives "[::1]". */
export function hostName(value: string | null | undefined): string {
  const t = (value ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/[/?#].*$/, "");
  if (t.startsWith("[")) {
    const end = t.indexOf("]");
    return end === -1 ? t : t.slice(0, end + 1);
  }
  return t.replace(/:\d+$/, "");
}

/** The names this copy answers to, or null when the guard is off. */
export function allowedHostNames(
  edition: string | undefined = process.env.DS_EDITION,
  extra: string | undefined = process.env.ALLOWED_HOSTS,
): Set<string> | null {
  const typed = (extra ?? "").split(",").map(hostName).filter(Boolean);
  if (editionOf(edition) !== "local" && typed.length === 0) return null;
  const names = new Set<string>(typed);
  if (editionOf(edition) === "local") for (const h of LOOPBACK_HOSTS) names.add(h);
  return names;
}

/**
 * The names with the ones from a leader's names file added (lib/host-names.ts, host mode only). The file's names were checked as whole names when
 * read (lib/host-names-core.ts); with the guard off (null) nothing changes, because a copy with no guard answers to every name anyway.
 */
export function withHostNames(allowed: Set<string> | null, extra: readonly string[]): Set<string> | null {
  if (allowed === null || extra.length === 0) return allowed;
  return new Set([...allowed, ...extra]);
}

/** Whether a request with this Host header may be answered. A missing Host is refused when the guard is on. */
export function hostAllowed(hostHeader: string | null | undefined, allowed: Set<string> | null = allowedHostNames()): boolean {
  if (allowed === null) return true;
  const name = hostName(hostHeader);
  return name !== "" && allowed.has(name);
}

/** Reads one request header: `request.headers` or `headers()` from next/headers. */
export type HeaderReader = { get(name: string): string | null };

/** Whether an address is on a Tailscale or Headscale network (100.64.0.0/10, or fd7a:115c:a1e0::/48). */
export function tailnetAddress(ip: string): boolean {
  const a = ip.trim().toLowerCase().replace(/^::ffff:/, "");
  const v4 = /^(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/.exec(a);
  if (v4) return Number(v4[1]) === 100 && Number(v4[2]) >= 64 && Number(v4[2]) <= 127;
  return a.startsWith("fd7a:115c:a1e0:");
}

/**
 * Whether a request was passed on by a proxy for someone on another computer. The Host header is written by the sender, so a friend can send
 * "Host: localhost" through `tailscale serve` or a Headscale reverse proxy; these signs give that away. A browser on this computer sends none of
 * them (Next.js itself fills X-Forwarded-For with the socket's one address when it is missing).
 */
export function cameThroughProxy(headers: HeaderReader): boolean {
  // `tailscale serve` names the tailnet person who sent the request, and drops a copy of this header sent by the browser.
  if (headers.get("tailscale-user-login")) return true;
  if (headers.get("forwarded")) return true;
  const forwardedFor = headers.get("x-forwarded-for") ?? "";
  if (forwardedFor.includes(",")) return true;
  return forwardedFor !== "" && tailnetAddress(forwardedFor);
}

export const HOST_REFUSED =
  "This address is not one this copy of the app answers to. Open it at http://localhost, or add the name to ALLOWED_HOSTS in the settings of the computer that runs it.";
