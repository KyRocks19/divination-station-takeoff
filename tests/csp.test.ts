import test from "node:test";
import assert from "node:assert/strict";
import { PICTURE_CSP, buildCsp, isPicturePath, makeNonce } from "../lib/csp";
import { readFileSync } from "node:fs";

const directive = (csp: string, name: string) => csp.split(";").map((d) => d.trim()).find((d) => d.startsWith(name + " "));

test("a nonce is different every time and long enough to be unguessable", () => {
  const seen = new Set(Array.from({ length: 50 }, makeNonce));
  assert.equal(seen.size, 50);
  for (const n of seen) assert.match(n, /^[A-Za-z0-9+/]{22}==$/); // 16 bytes of base64
});

test("scripts need the nonce: no 'unsafe-inline' in script-src, in production or development", () => {
  for (const dev of [false, true]) {
    const script = directive(buildCsp("abc123==", dev), "script-src")!;
    assert.ok(script.includes("'nonce-abc123=='"));
    assert.ok(script.includes("'strict-dynamic'"));
    assert.ok(!script.includes("'unsafe-inline'"), script);
  }
});

test("'unsafe-eval' is for development only", () => {
  assert.ok(directive(buildCsp("n", true), "script-src")!.includes("'unsafe-eval'"));
  assert.ok(!buildCsp("n", false).includes("unsafe-eval"));
});

test("the other protections are kept: no framing, no other sites, no plugins, forms and base to this site", () => {
  const csp = buildCsp("n");
  for (const d of ["default-src 'self'", "frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'", "object-src 'none'", "connect-src 'self'", "worker-src 'self'"]) {
    assert.ok(csp.split("; ").includes(d) || csp.includes(d + ";"), d);
  }
  assert.ok(directive(csp, "img-src")!.includes("data:") && directive(csp, "img-src")!.includes("blob:"));
});

test("production allows no 'unsafe-inline' anywhere: styles need the nonce and a style attribute is refused", () => {
  const csp = buildCsp("abc123==");
  assert.ok(!csp.includes("'unsafe-inline'"), csp);
  assert.equal(directive(csp, "style-src"), "style-src 'self' 'nonce-abc123=='");
  assert.equal(directive(csp, "style-src-attr"), "style-src-attr 'none'");
});

test("development keeps 'unsafe-inline' for styles, for Next.js's own development tools", () => {
  assert.ok(directive(buildCsp("n", true), "style-src")!.includes("'unsafe-inline'"));
  assert.equal(directive(buildCsp("n", true), "style-src-attr"), undefined);
});

test("a picture on its own address gets the sandbox policy from the proxy, which replaces the route's own header (E9)", () => {
  assert.ok(isPicturePath("/api/oracle/cards/12/art"));
  assert.ok(isPicturePath("/api/oracle/gallery/3"));
  assert.ok(!isPicturePath("/api/oracle/gallery"));
  assert.ok(!isPicturePath("/api/oracle/cards/12"));
  assert.ok(!isPicturePath("/oracle/gallery"));
  assert.match(PICTURE_CSP, /default-src 'none'/);
  assert.match(PICTURE_CSP, /sandbox/);
  assert.doesNotMatch(PICTURE_CSP, /script-src/);
  assert.match(readFileSync("proxy.ts", "utf8"), /isPicturePath\(pathname\) \? PICTURE_CSP : csp/);
  for (const f of ["app/api/oracle/cards/[id]/art/route.ts", "app/api/oracle/gallery/[id]/route.ts"]) {
    assert.match(readFileSync(f, "utf8"), /"Content-Security-Policy": PICTURE_CSP/, f);
  }
});
