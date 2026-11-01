// The page security policy (open item S4). Every page request gets a fresh random nonce from proxy.ts, and scripts may run only if
// they carry it (Next.js stamps it on its own scripts when it sees it in the request's CSP header), so a script that someone managed to
// inject into a page cannot run: it has no nonce. Styles are the same: a <style> element needs the nonce, and a style="..." attribute is refused
// outright (style-src-attr 'none'), so nothing in production allows 'unsafe-inline'. The app therefore writes no style attributes: fixed values are
// classes, and values worked out from the person's data are put on by script (lib/apply-style.ts, which a browser allows because it goes through the
// element's style object). tests/no-inline-style.test.ts keeps it that way. Development keeps 'unsafe-inline' for styles, because Next.js's own
// development tools inject some.
// Pure functions, no imports, so the rule can be tested. Guide: node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md

/** A fresh, unguessable value for one request: 128 random bits as base64. */
export function makeNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

/**
 * The Content-Security-Policy header for one request.
 * 'strict-dynamic' lets a script that carries the nonce load the further scripts it needs (Next.js loads its page chunks this way);
 * browsers that understand it ignore 'self' for scripts, which is why workers (the offline picture cache) are listed apart.
 * Development also needs 'unsafe-eval', because React uses eval for its debugging features. Production never does.
 */
export function buildCsp(nonce: string, development = false): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ""}`,
    ...(development ? ["style-src 'self' 'unsafe-inline'"] : [`style-src 'self' 'nonce-${nonce}'`, "style-src-attr 'none'"]),
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "worker-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ") + ";";
}

/**
 * The policy for a picture answered on its own address (an item's picture, a gallery picture). An SVG drawing opened directly is a document,
 * so it gets no scripts, no loads and a sandbox (open item E9). proxy.ts sets this one instead of the page policy on these paths: a header the
 * proxy sets replaces the route's own, which a check against a running server showed on 2026-10-22 (scripts/check-sandbox-headers.mts).
 */
export const PICTURE_CSP = "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; sandbox";

/** True for the paths that answer with a picture and get PICTURE_CSP. */
export function isPicturePath(pathname: string): boolean {
  return /^\/api\/oracle\/(cards\/[^/]+\/art|gallery\/[^/]+)\/?$/.test(pathname);
}
