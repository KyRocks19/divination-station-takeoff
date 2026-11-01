// A second guard against another website making a signed-in browser change something (the cookie is already SameSite=Lax).
// A browser always names the page a request came from in the Origin header on a POST, PUT, PATCH, or DELETE; if that page
// is not this app, the request is refused. Requests with no Origin (the Claude tool key, scripts, old browsers) are not
// browser page requests and are left to their own checks.

/** Host names (with port) that count as this app: the ones the request arrived on, plus ALLOWED_ORIGINS (comma-separated hosts). */
export function ownHosts(headers: Headers, requestHost: string, extra = process.env.ALLOWED_ORIGINS ?? ""): Set<string> {
  const hosts = new Set<string>();
  for (const h of [requestHost, headers.get("host"), headers.get("x-forwarded-host")?.split(",")[0].trim()]) {
    if (h) hosts.add(h.toLowerCase());
  }
  for (const h of extra.split(",")) {
    const t = h.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (t) hosts.add(t);
  }
  return hosts;
}

/** True when a request that changes data may go on. */
export function originAllowed(method: string, headers: Headers, requestHost: string, extra?: string): boolean {
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return true;
  const origin = headers.get("origin");
  if (!origin) return true;
  if (origin === "null") return false;
  let host: string;
  try {
    host = new URL(origin).host.toLowerCase();
  } catch {
    return false;
  }
  return ownHosts(headers, requestHost, extra).has(host);
}
